"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { studySupportRebounds } from "@/app/lib/supportReboundResearch";
import type { ReboundCandle, ReboundTrade } from "@/app/lib/supportReboundResearch";

type Payload = { success: true; code: string; candles: ReboundCandle[]; splitEvents: number[]; provisionalBarExcluded: boolean };
type Item = { code: string; data: Payload | null; error: string | null };
const DEFAULT_CODES = ["7203", "6758", "8306", "9984"];
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
  const [revision, setRevision] = useState(0);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setBusy(true); setError(""); setItems([]);
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
        results.push(...batch);
      }
      if (!controller.signal.aborted) { setItems(results); setBusy(false); }
    };
    void load();
    return () => controller.abort();
  }, [codes, range, revision]);

  const studies = useMemo(() => items.flatMap((item) => item.data ? [{
    code: item.code,
    bars: item.data.candles.length,
    result: studySupportRebounds(item.data.candles, {
      holdBars, shares: 100, splitEvents: item.data.splitEvents || [],
    }),
  }] : []), [items, holdBars]);
  const rollup = useMemo(() => {
    const all = studies.flatMap((s) => s.result.opportunities.map((o) => ({ code: s.code, ...o })));
    const paired = all.filter((o) => o.hintTrade && o.confirmedTrade);
    return {
      all, paired,
      hints: all.flatMap((o) => o.hintTrade ? [o.hintTrade] : []),
      confirmations: all.flatMap((o) => o.confirmedTrade ? [o.confirmedTrade] : []),
      pairedHints: paired.map((o) => o.hintTrade!),
      pairedConfirmed: paired.map((o) => o.confirmedTrade!),
      betterConfirmed: paired.filter((o) => o.confirmedTrade!.returnPercent > o.hintTrade!.returnPercent).length,
      awaitingHints: all.filter((o) => !o.hintTrade).length,
      awaitingConfirmed: all.filter((o) => o.confirmedTime !== null && !o.confirmedTrade).length,
    };
  }, [studies]);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const list = [...new Set(input.trim().toUpperCase().split(/[\s,、，]+/).filter(Boolean))];
    if (list.length < 1 || list.length > 5 || list.some((code) => !/^[0-9A-Z]{4}$/.test(code))) {
      setError("日本株の4桁の銘柄コードを1〜5個入力してください"); return;
    }
    setCodes(list); setRevision((n) => n + 1);
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
          <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-sm font-bold">銘柄コード（1〜5個）
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
          <button type="submit" disabled={busy} className="min-h-12 rounded-xl bg-indigo-600 px-5 font-bold text-white disabled:opacity-50">
            {busy ? "取得中…" : "再検証"}
          </button>
        </form>
      </header>
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</p>}
      {busy && <p className="mt-4 rounded-xl bg-white p-4 text-sm text-slate-500">確定日足を2銘柄ずつ取得中…</p>}
      {items.filter((x) => x.error).map((x) => <p key={x.code} className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{x.code}：{x.error}</p>)}
      {!busy && studies.length > 0 && <>
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
        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-black">📊 候補数・保留中</h2>
          <p className="mt-2 text-sm">③を検出：{rollup.all.length}件 → ②まで進んだ：{rollup.all.filter((o) => o.confirmedTime !== null).length}件</p>
          <p className="mt-1 text-sm">結果待ち：③ {rollup.awaitingHints}件／② {rollup.awaitingConfirmed}件</p>
          <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[490px] text-left text-sm">
            <thead><tr className="bg-slate-100"><th className="p-2">銘柄</th><th className="p-2">日足数</th><th className="p-2">③候補</th><th className="p-2">②候補</th><th className="p-2">②勝率</th></tr></thead>
            <tbody>{studies.map((s) => <tr key={s.code} className="border-t border-slate-100">
              <td className="p-2"><Link className="font-bold text-blue-600" href={"/chart/" + s.code}>{s.code} ↗</Link></td>
              <td className="p-2">{s.bars}</td><td className="p-2">{s.result.hintCount}</td><td className="p-2">{s.result.confirmedCount}</td>
              <td className="p-2">{pct(s.result.confirmations.winRatePercent)}</td>
            </tr>)}</tbody>
          </table></div>
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
        【暫定検証ルール】支持線は過去20営業日の最安値。直前3営業日の終値下落後、支持線付近（安値が支持線の-2%〜+2%）に小さな陽線（実体が値幅の50%以下）で③。3営業日以内に陽線2本連続、終値上昇かつ支持線を維持すれば②。③を出した後の4営業日は同じ銘柄で新候補を重複計上しません。保有期間は仮想買付後の3・5・10営業日、売却は翌セッション始値。株式分割が重なる期間を除外。100株ずつの単純合算で、資金制約、税・手数料・スリッページは考慮しません。母数や銘柄選択・日足データ品質に限界があり、将来の勝率を保証しません。DB保存・通知・実売買・本番AI判定への反映はありません。
      </p>
    </div>
  </main>;
}
