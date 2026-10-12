"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { studySupportRebounds } from "@/app/lib/supportReboundResearch";
import type { ReboundCandle, ReboundTrade } from "@/app/lib/supportReboundResearch";
import { SUPPORT_REBOUND_20, SUPPORT_REBOUND_100 } from "@/app/lib/research/supportReboundUniverse";
import { getSectorLabel } from "@/app/lib/sectorMap";
import SupportReboundRiskPanel from "./SupportReboundRiskPanel";
import SupportReboundScorePanel from "./SupportReboundScorePanel";

type Payload = { success: true; code: string; candles: ReboundCandle[]; splitEvents: number[]; provisionalBarExcluded: boolean };
type Item = { code: string; data: Payload | null; error: string | null };
const DEFAULT_CODES = ["7203", "6758", "8306", "9984"];
const TEST_CUTOFF = Date.parse("2025-10-01T00:00:00Z") / 1000;
type Phase = "ALL" | "TRAIN" | "TEST";
function inPeriod(trade: ReboundTrade, phase: Phase) {
  return phase === "ALL" || (phase === "TRAIN" && trade.exitTime < TEST_CUTOFF)
    || (phase === "TEST" && trade.entryTime >= TEST_CUTOFF);
}
const validCode = (code: string) => /^[0-9A-Z]{4}$/.test(code);
const fmt = (n: number) => n.toLocaleString("ja-JP", { maximumFractionDigits: 2 });
const pct = (n: number | null) => n == null ? "—" : (n > 0 ? "+" : "") + fmt(n) + "%";
const yen = (n: number) => (n > 0 ? "+" : "") + fmt(n) + "円";
const day = (time: number) => new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date(time * 1000));
function aggregate(trades: ReboundTrade[]) {
  const n = trades.length, wins = trades.filter((t) => t.pnlYen > 0).length;
  return {
    count: n, winRate: n ? 100 * wins / n : null,
    average: n ? trades.reduce((sum, t) => sum + t.returnPercent, 0) / n : null,
    total: trades.reduce((sum, t) => sum + t.pnlYen, 0),
    worst: n ? Math.min(...trades.map((t) => t.returnPercent)) : null,
  };
}
function Summary({ title, description, trades }: { title: string; description: string; trades: ReboundTrade[] }) {
  const x = aggregate(trades);
  return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <h2 className="text-lg font-black">{title}</h2>
    <p className="mt-1 text-xs text-slate-500">{description}</p>
    <div className="mt-3 grid grid-cols-2 gap-3">
      <div><p className="text-xs text-slate-500">完了取引</p><p className="text-xl font-black">{x.count}件</p></div>
      <div><p className="text-xs text-slate-500">勝率</p><p className="text-xl font-black">{pct(x.winRate)}</p></div>
      <div><p className="text-xs text-slate-500">平均騰落率</p><p className="text-lg font-bold">{pct(x.average)}</p></div>
      <div><p className="text-xs text-slate-500">最悪の1取引</p><p className="text-lg font-bold">{pct(x.worst)}</p></div>
    </div>
    <p className="mt-3 border-t border-slate-100 pt-3 text-sm font-bold">100株ずつの単純損益合計 {yen(x.total)}</p>
  </article>;
}

export default function SupportReboundClient() {
  const [input, setInput] = useState(DEFAULT_CODES.join(", "));
  const [codes, setCodes] = useState(DEFAULT_CODES);
  const [range, setRange] = useState<"6mo" | "2y">("2y");
  const [holdBars, setHoldBars] = useState(5);
  const [phase, setPhase] = useState<Phase>("ALL");
  const [completed, setCompleted] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);
  const [revision, setRevision] = useState(0);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;
    const load = async () => {
      setBusy(true); setError(""); setItems([]); setCompleted(0);
      const results: Item[] = [];
      for (let i = 0; i < codes.length && !controller.signal.aborted; i += 2) {
        const batch = await Promise.all(codes.slice(i, i + 2).map(async (code): Promise<Item> => {
          try {
            const response = await fetch("/api/admin/ema-signals?code=" + encodeURIComponent(code) + "&range=" + range, {
              cache: "no-store", signal: controller.signal,
            });
            const data = await response.json();
            if (!response.ok || data.success !== true) throw new Error(data.error || "日足の取得失敗");
            return { code, data: data as Payload, error: null };
          } catch (reason) {
            return { code, data: null, error: reason instanceof Error ? reason.message : "取得失敗" };
          }
        }));
        if (controller.signal.aborted) break;
        results.push(...batch);
        setItems([...results]);
        setCompleted(results.length);
        // Throttle request bursts: 2 concurrent per batch, 300ms between batches.
        if (i + 2 < codes.length) await new Promise<void>((resolve) => setTimeout(resolve, 300));
      }
      if (!controller.signal.aborted) { setBusy(false); controllerRef.current = null; }
    };
    void load();
    return () => { controller.abort(); if (controllerRef.current === controller) controllerRef.current = null; };
  }, [codes, range, revision]);

  const studies = useMemo(() => items.flatMap((item) => item.data ? [{
    code: item.code,
    bars: item.data.candles.length,
    candles: item.data.candles,
    splitEvents: item.data.splitEvents ?? [],
    result: studySupportRebounds(item.data.candles, {
      holdBars, shares: 100, splitEvents: item.data.splitEvents || [],
    }),
  }] : []), [items, holdBars]);
  const rollup = useMemo(() => {
    const all = studies.flatMap((s) => s.result.opportunities
      .filter((o) => phase === "ALL" || (phase === "TRAIN" ? o.hintTime < TEST_CUTOFF : o.hintTime >= TEST_CUTOFF))
      .map((o) => ({ code: s.code, ...o })));
    const hints = all.flatMap((o) => o.hintTrade && inPeriod(o.hintTrade, phase) ? [o.hintTrade] : []);
    const confirmations = all.flatMap((o) => o.confirmedTrade && inPeriod(o.confirmedTrade, phase) ? [o.confirmedTrade] : []);
    const paired = all.filter((o) => o.hintTrade && o.confirmedTrade &&
      inPeriod(o.hintTrade, phase) && inPeriod(o.confirmedTrade, phase));
    const highDrop: ReboundTrade[] = [], lowDrop: ReboundTrade[] = [];
    const byCode = new Map(studies.map((study) => [study.code, study.candles]));
    for (const o of all) {
      if (!o.hintTrade || !inPeriod(o.hintTrade, phase)) continue;
      const bars = byCode.get(o.code);
      if (!bars || o.hintIndex < 3) continue;
      const first = bars[o.hintIndex - 4].close;
      const last = bars[o.hintIndex - 1].close;
      (first > 0 && 100 * (last / first - 1) <= -5 ? highDrop : lowDrop).push(o.hintTrade);
    }
    return {
      all, paired, hints, confirmations, highDrop, lowDrop,
      pairedHints: paired.map((o) => o.hintTrade!),
      pairedConfirmed: paired.map((o) => o.confirmedTrade!),
      betterConfirmed: paired.filter((o) => o.confirmedTrade!.returnPercent > o.hintTrade!.returnPercent).length,
      awaitingHints: all.filter((o) => !o.hintTrade && phase !== "TRAIN").length,
      awaitingConfirmed: all.filter((o) => o.confirmedTime !== null && !o.confirmedTrade && phase !== "TRAIN").length,
    };
  }, [studies, phase]);
  const sectorStats = useMemo(() => {
    const sectors = new Map<string, { codes: Set<string>; hints: ReboundTrade[]; confirmations: ReboundTrade[] }>();
    for (const row of rollup.all) {
      const sector = getSectorLabel(row.code);
      if (!sectors.has(sector)) sectors.set(sector, { codes: new Set(), hints: [], confirmations: [] });
      const entry = sectors.get(sector)!;
      entry.codes.add(row.code);
      if (row.hintTrade && inPeriod(row.hintTrade, phase)) entry.hints.push(row.hintTrade);
      if (row.confirmedTrade && inPeriod(row.confirmedTrade, phase)) entry.confirmations.push(row.confirmedTrade);
    }
    return [...sectors.entries()].map(([sector, x]) => ({ sector, stocks: x.codes.size, hints: aggregate(x.hints), confirmations: aggregate(x.confirmations) }))
      .sort((a, b) => b.hints.count - a.hints.count);
  }, [rollup, phase]);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const list = [...new Set(input.trim().toUpperCase().split(/[\s,、，]+/).filter(Boolean))];
    if (list.length < 1 || list.length > 100 || list.some((code) => !validCode(code))) {
      setError("日本株の4桁の銘柄コードを1〜100個入力してください"); return;
    }
    setCodes(list); setRevision((n) => n + 1);
  }

  function choosePreset(size: 20 | 100) {
    const list = (size === 20 ? SUPPORT_REBOUND_20 : SUPPORT_REBOUND_100).map((s) => s.code);
    setInput(list.join(", ")); setCodes(list); setRevision((n) => n + 1);
  }
  function cancel() {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setBusy(false);
  }
  return <main className="min-h-screen bg-slate-50 px-3 py-5 text-slate-900">
    <div className="mx-auto max-w-5xl">
      <Link href="/admin/learning-hub" className="text-sm font-bold text-blue-600">← 学習データ・管理室へ</Link>
      <header className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-black tracking-widest text-violet-600">ADMIN / READ ONLY · SHADOW RESEARCH</p>
        <h1 className="mt-2 text-2xl font-black">🌱 支持線反発・2段階研究</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          ③「支持線付近で小さな陽線」→ ②「陽線2本で反発を確認」を比較します。
          過去の確定日足だけを使い、各サインの翌営業日始値で仮想購入。売買判定や通知は変更しません。
        </p>
        <form onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-sm font-bold">銘柄コード（1〜100個）
            <input value={input} onChange={(e) => setInput(e.target.value)} autoComplete="off"
              className="min-h-12 rounded-xl border border-slate-300 bg-white px-3 text-base" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-bold">期間
            <select value={range} onChange={(e) => setRange(e.target.value as "6mo" | "2y")}
              className="min-h-12 rounded-xl border border-slate-300 bg-white px-3 text-base">
              <option value="2y">約2年間</option><option value="6mo">約6か月</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-bold">保有期間
            <select value={holdBars} onChange={(e) => setHoldBars(Number(e.target.value))}
              className="min-h-12 rounded-xl border border-slate-300 bg-white px-3 text-base">
              <option value={3}>3営業日</option><option value={5}>5営業日</option><option value={10}>10営業日</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-bold">比較する期間
            <select value={phase} onChange={(e) => setPhase(e.target.value as Phase)} className="min-h-12 rounded-xl border border-slate-300 bg-white px-3 text-base">
              <option value="ALL">全期間</option><option value="TRAIN">2025/9まで</option><option value="TEST">2025/10以降</option>
            </select>
          </label>
          <button type="submit" disabled={busy} className="min-h-12 rounded-xl bg-indigo-600 px-5 font-bold text-white disabled:opacity-50">
            {busy ? "取得中…" : "再検証"}
          </button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => choosePreset(20)} className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-black text-indigo-700 disabled:opacity-50">20銘柄で試す</button>
          <button type="button" disabled={busy} onClick={() => choosePreset(100)} className="rounded-xl border border-indigo-300 bg-white px-4 py-3 text-sm font-black text-indigo-800 disabled:opacity-50">100銘柄の拡大検証</button>
          {busy && <button type="button" onClick={cancel} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">取得を中断</button>}
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-500">20・100銘柄はSIGNALX登録銘柄からの固定選定（無作為抽出ではありません）。クリックすると取得開始。100件は通信状況により時間がかかります。既存の日足取得APIを2件ずつ利用し、追加の定期ジョブ・DB保存はありません。</p>
      </header>
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</p>}
      {(busy || completed > 0) && <div className="mt-4 rounded-xl bg-white p-4 text-sm text-slate-600" role="status" aria-live="polite">
        {busy ? "取得中" : completed < codes.length ? "中断・一部取得済み" : "取得完了"}：{completed} / {codes.length} 銘柄（成功 {studies.length}件／失敗 {items.filter((x) => x.error).length}件）
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: (100 * completed / Math.max(1, codes.length)) + "%" }} /></div>
        {completed < codes.length && <p className="mt-2 text-xs">途中までの結果も暫定表示します。完了前は全体の勝率として評価しないでください。</p>}
      </div>}
      {items.some((x) => x.error) && <details className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
        <summary className="cursor-pointer font-bold">取得できなかった銘柄：{items.filter((x) => x.error).length}件（タップで詳細）</summary>
        <div className="mt-2 max-h-60 space-y-1 overflow-y-auto">{items.filter((x) => x.error).map((x) => <p key={x.code}>{x.code}：{x.error}</p>)}</div>
      </details>}
      {studies.length > 0 && <>
        <p className="mt-4 text-xs text-slate-600">対象：{phase === "ALL" ? "全期間" : phase === "TRAIN" ? "2025年9月までに取引完了" : "2025年10月以降に買付"} ／ {holdBars}営業日保有。学習済み期間を分ける参考検証で、完全な未使用データ検証ではありません。</p>
        <section className="mt-5 grid gap-3 sm:grid-cols-2">
          <Summary title="③ 反発の兆しで買う" description="未確認の失敗も含む・早めの購入" trades={rollup.hints} />
          <Summary title="② 反発確認後に買う" description="③から3営業日以内に陽線2本で確認" trades={rollup.confirmations} />
        </section>
        <section className="mt-4 rounded-2xl border border-violet-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-black">🔍 同じ反発チャンスに限定して比較</h2>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            ③から②まで進み、両方の損益が確定した {rollup.paired.length} 件のみ。未確認の③は除外するため、上の全候補比較とは母数が異なります。
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 p-3"><p className="text-sm font-bold">③ 早め</p><p className="text-xl font-black">{pct(aggregate(rollup.pairedHints).winRate)}</p><p className="text-xs">平均 {pct(aggregate(rollup.pairedHints).average)}</p></div>
            <div className="rounded-xl bg-violet-50 p-3"><p className="text-sm font-bold">② 確認後</p><p className="text-xl font-black">{pct(aggregate(rollup.pairedConfirmed).winRate)}</p><p className="text-xs">平均 {pct(aggregate(rollup.pairedConfirmed).average)}</p></div>
          </div>
          <p className="mt-3 text-sm">②の騰落率が③を上回ったケース：<strong>{rollup.betterConfirmed} / {rollup.paired.length} 件</strong></p>
        </section>
        <section className="mt-4 rounded-2xl border border-rose-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-black">⚠️ ③の損失リスクと急落型</h2>
          <p className="mt-2 text-sm">保有中に一時 -5%以上逆行：{rollup.hints.filter((t) => t.worstIntratradePercent <= -5).length} / {rollup.hints.length} 件</p>
          <p className="mt-1 text-sm">③の5営業日などの確定損益が -5%以下：{rollup.hints.filter((t) => t.returnPercent <= -5).length} 件</p>
          <p className="mt-2 text-xs text-slate-500">「直前3営業日で終値が5%以上下落した③」と、それ以外を区別。③を見た時点で分かる条件だけを使った参考分類です。</p>
          <div className="mt-3 grid grid-cols-2 gap-3">{[
            { title: "直前急落 -5%以上", trades: rollup.highDrop },
            { title: "直前下落 -5%未満", trades: rollup.lowDrop },
          ].map((group) => <div key={group.title} className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-black">{group.title}</p><p className="mt-2 text-lg font-black">{pct(aggregate(group.trades).winRate)}</p><p className="text-xs">完了 {group.trades.length}件／平均 {pct(aggregate(group.trades).average)}</p></div>)}</div>
          <p className="mt-2 text-xs text-slate-500">急落型の成績が悪くても、今回の数値だけで除外ルールを本番AIに採用しません。</p>
        </section>
        <SupportReboundRiskPanel studies={studies} busy={busy} completed={completed} expected={codes.length} holdBars={holdBars} phase={phase} />
        <SupportReboundScorePanel studies={studies} busy={busy} completed={completed} expected={codes.length} holdBars={holdBars} phase={phase} />
        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-black">📊 候補数・保留中</h2>
          <p className="mt-2 text-sm">③を検出：{rollup.all.length}件 → ②まで進んだ：{rollup.all.filter((o) => o.confirmedTime !== null).length}件</p>
          <p className="mt-1 text-sm">結果待ち：③ {rollup.awaitingHints}件／② {rollup.awaitingConfirmed}件</p>
          <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[490px] text-left text-sm">
            <thead><tr className="bg-slate-100"><th className="p-2">銘柄</th><th className="p-2">日足数</th><th className="p-2">③候補</th><th className="p-2">②候補</th><th className="p-2">②勝率</th></tr></thead>
            <tbody>{studies.map((s) => <tr key={s.code} className="border-t border-slate-100">
              <td className="p-2"><Link className="font-bold text-blue-600" href={"/chart/" + s.code}>{s.code} ↗</Link></td>
              <td className="p-2">{s.bars}</td><td className="p-2">{s.result.opportunities.filter((o) => phase === "ALL" || (phase === "TRAIN" ? o.hintTime < TEST_CUTOFF : o.hintTime >= TEST_CUTOFF)).length}</td>
              <td className="p-2">{s.result.opportunities.filter((o) => o.confirmedTrade && inPeriod(o.confirmedTrade, phase) && (phase === "ALL" || (phase === "TRAIN" ? o.hintTime < TEST_CUTOFF : o.hintTime >= TEST_CUTOFF))).length}</td>
              <td className="p-2">{pct(aggregate(s.result.opportunities.flatMap((o) => o.confirmedTrade && inPeriod(o.confirmedTrade, phase) ? [o.confirmedTrade] : [])).winRate)}</td>
            </tr>)}</tbody>
          </table></div>
        </section>
        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-black">🏭 業種別の研究結果</h2>
          <p className="mt-1 text-xs text-slate-500">サインが出た銘柄のみの統計。業種はSIGNALXの簡易分類で「その他」を含みます。</p>
          <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[450px] text-left text-sm"><thead><tr className="bg-slate-100"><th className="p-2">業種</th><th className="p-2">③件数</th><th className="p-2">③勝率</th><th className="p-2">②件数</th><th className="p-2">②勝率</th></tr></thead><tbody>{sectorStats.map((s) => <tr className="border-t border-slate-100" key={s.sector}><td className="p-2">{s.sector}</td><td className="p-2">{s.hints.count}</td><td className="p-2">{pct(s.hints.winRate)}</td><td className="p-2">{s.confirmations.count}</td><td className="p-2">{pct(s.confirmations.winRate)}</td></tr>)}</tbody></table></div>
        </section>
        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-black">🗓️ 最近の検出例</h2>
          {!rollup.all.length && <p className="mt-2 text-sm text-slate-500">この条件ではまだ候補が見つかっていません。</p>}
          <div className="mt-3 space-y-2">{[...rollup.all].sort((a, b) => b.hintTime - a.hintTime).slice(0, 12).map((o) =>
            <div key={o.code + o.hintTime} className="rounded-xl border border-slate-100 p-3 text-sm">
              <Link className="font-black text-blue-600" href={"/chart/" + o.code}>{o.code} ↗</Link>
              <span className="ml-2 text-xs text-slate-500">③ {day(o.hintTime)}</span>
              <p className="mt-1">{o.confirmedTime ? "②確認 " + day(o.confirmedTime) : "②未確認"} ／ ③ {o.hintTrade ? pct(o.hintTrade.returnPercent) : "結果待ち"} ／ ② {o.confirmedTrade ? pct(o.confirmedTrade.returnPercent) : o.confirmedTime ? "結果待ち" : "対象外"}</p>
            </div>)}</div>
        </section>
      </>}
      <p className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-6 text-slate-600">
        【100銘柄拡大検証】「直前3営業日の下落率」は③の4本前の終値と1本前の終値から計算します。母集団は現時点の登録銘柄からの固定選定で、上場廃止や生存者バイアスの可能性があります。Yahooの日足取得が失敗した銘柄は集計から除外され、取得失敗数を表示します。過去の同一銘柄・相関の高い銘柄でサインが重なるため、件数を独立試行と見なせません。
        【暫定検証ルール】支持線は過去20営業日の最安値。直前3営業日の終値下落後、支持線付近（安値が支持線の-2%〜+2%）に小さな陽線（実体が値幅の50%以下）で③。3営業日以内に陽線2本連続、終値上昇かつ支持線を維持すれば②。③を出した後の4営業日は同じ銘柄で新候補を重複計上しません。保有期間は仮想買付後の3・5・10営業日、売却は翌セッション始値。株式分割が重なる期間を除外。100株ずつの単純合算で、資金制約、税・手数料・スリッページは考慮しません。母数や銘柄選択・日足データ品質に限界があり、将来の勝率を保証しません。DB保存・通知・実売買・本番AI判定への反映はありません。
      </p>
    </div>
  </main>;
}
