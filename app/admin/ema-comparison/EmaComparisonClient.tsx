"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { EMA_VARIANT_DETAILS, EMA_VARIANT_IDS, compareEmaVariants } from "@/app/lib/emaSignalComparison";
import type { EmaVariantId } from "@/app/lib/emaSignalComparison";
import type { EmaCandle } from "@/app/lib/emaCrossoverBacktest";

type ApiPayload = { success: true; code: string; range: "6mo" | "2y"; candles: EmaCandle[] };
type Item = { code: string; data: ApiPayload | null; error: string | null };
type Backtest = ReturnType<typeof compareEmaVariants>;
type Aggregate = { trades: number; wins: number; losses: number; flat: number; pnl: number; totalReturn: number; drawdown: number; sampleStocks: number; eligibleStocks: number };
const INITIAL_CODES = ["7203", "6758", "8306", "9984"];

const fmt = (n: number) => n.toLocaleString("ja-JP", { maximumFractionDigits: 2 });
const money = (n: number) => (n > 0 ? "+" : "") + fmt(n) + "円";
const percent = (n: number | null) => n === null ? "—" : fmt(n) + "%";

function parseCodes(raw: string) {
  const all = raw.trim().split(/[\s,、，]+/).filter(Boolean);
  if (all.some((x) => !/^\d{4}$/.test(x))) return { error: "日本株の4桁の銘柄コードを入力してください", codes: [] };
  const codes = [...new Set(all)];
  if (codes.length < 2 || codes.length > 5) return { error: "重複を除き、2〜5銘柄を入力してください", codes: [] };
  return { error: "", codes };
}

export default function EmaComparisonClient() {
  const [input, setInput] = useState(INITIAL_CODES.join(", "));
  const [codes, setCodes] = useState(INITIAL_CODES);
  const [range, setRange] = useState<"6mo" | "2y">("2y");
  const [nonce, setNonce] = useState(0);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setBusy(true);
      setItems([]);
      setError("");
      const results: Item[] = [];
      // Two at a time to avoid a burst of requests to the stock-data provider.
      for (let offset = 0; offset < codes.length && !controller.signal.aborted; offset += 2) {
        const batch = await Promise.all(codes.slice(offset, offset + 2).map(async (code): Promise<Item> => {
          try {
            const response = await fetch("/api/admin/ema-signals?code=" + code + "&range=" + range, {
              cache: "no-store",
              signal: controller.signal,
            });
            const payload = await response.json();
            if (!response.ok || payload.success !== true) throw new Error(payload.error || "取得失敗");
            return { code, data: payload as ApiPayload, error: null };
          } catch (reason) {
            return { code, data: null, error: reason instanceof Error ? reason.message : "取得失敗" };
          }
        }));
        results.push(...batch);
      }
      if (!controller.signal.aborted) {
        setItems(results);
        setBusy(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [codes, nonce, range]);

  const studies = useMemo(() => items.filter((item): item is Item & { data: ApiPayload } => item.data !== null)
    .map((item) => ({ code: item.code, candles: item.data.candles.length, lastTime: item.data.candles.at(-1)?.time ?? null, results: compareEmaVariants(item.data.candles) })), [items]);

  const aggregate = useMemo(() => Object.fromEntries(EMA_VARIANT_IDS.map((id) => {
    const summary: Aggregate = { trades: 0, wins: 0, losses: 0, flat: 0, pnl: 0, totalReturn: 0, drawdown: 0, sampleStocks: 0, eligibleStocks: studies.length };
    for (const study of studies) {
      const stat = study.results[id].stats;
      summary.trades += stat.closedTrades;
      summary.wins += stat.wins;
      summary.losses += stat.losses;
      summary.flat += stat.flat;
      summary.pnl += stat.totalPnlYen;

      if (stat.closedTrades > 0) summary.sampleStocks += 1;
    }
    // Aggregate return means every completed trade across all stocks, not the average of stock win rates.
    summary.totalReturn = studies.reduce((sum, study) => sum + study.results[id].trades.reduce((s, trade) => s + trade.returnPercent, 0), 0);
    // Per-strategy drawdown across different stocks is deliberately not summed.
    summary.drawdown = 0;
    return [id, summary];
  })) as Record<EmaVariantId, Aggregate>, [studies]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseCodes(input);
    if (parsed.error) { setError(parsed.error); return; }
    setCodes(parsed.codes);
    setNonce((v) => v + 1);
  }

  const failed = items.filter((item) => item.error);
  return <main className="min-h-screen bg-slate-50 px-3 py-5 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
    <div className="mx-auto max-w-6xl">
      <Link href="/admin/ema-signals" className="text-sm font-bold text-blue-600">← EMA売買サイン研究へ戻る</Link>
      <header className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <p className="text-xs font-black tracking-widest text-violet-600">ADMIN RESEARCH / SHADOW ONLY</p>
        <h1 className="mt-2 text-2xl font-black">🧪 EMA売買条件・複数銘柄比較</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">同じ日足・同じ翌営業日始値の売買ルールで、EMA単独と2つの買い条件を比較。結果をAI判定や通知へ反映しません。</p>
        <form onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-sm font-bold">銘柄コード（2〜5個、カンマ区切り）
            <input value={input} onChange={(e) => setInput(e.target.value)} autoComplete="off" className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 dark:border-slate-600" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-bold">期間
            <select value={range} onChange={(e) => setRange(e.target.value as "6mo" | "2y")} className="min-h-12 rounded-xl border border-slate-300 bg-white px-3 text-slate-900 dark:border-slate-600">
              <option value="2y">約2年間</option><option value="6mo">約6か月</option>
            </select>
          </label>
          <button type="submit" disabled={busy} className="min-h-12 rounded-xl bg-violet-600 px-5 font-black text-white disabled:opacity-50">{busy ? "比較中…" : "比較する"}</button>
        </form>
        {error && <p className="mt-3 text-sm font-bold text-red-600">{error}</p>}
      </header>

      <section className="mt-4 grid gap-2 md:grid-cols-3">
        {EMA_VARIANT_IDS.map((id) => <article key={id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="font-black">{EMA_VARIANT_DETAILS[id].title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{EMA_VARIANT_DETAILS[id].rule}</p>
          <p className="mt-1 text-xs text-slate-400">売りは共通：EMA9がEMA21を下抜け</p>
        </article>)}
      </section>

      {busy && <p className="mt-4 rounded-xl bg-white p-5 font-bold text-slate-500 dark:bg-slate-900">データを取得・検証中…（最大5銘柄）</p>}
      {!busy && <>
        {failed.length > 0 && <section className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
          取得できない銘柄があります：{failed.map((item) => item.code + "（" + item.error + "）").join("、")}。これらは比較集計から除外しました。
        </section>}
        {studies.length > 0 && <>
          <section className="mt-5">
            <h2 className="text-xl font-black">📊 全銘柄の比較（取得済み {studies.length} / 指定 {codes.length} 銘柄）</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">各銘柄を100株ずつ・期間中の全完了取引を合算。未決済を含まない。資金量の違い・手数料・税金は未考慮。</p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {EMA_VARIANT_IDS.map((id) => {
                const row = aggregate[id];
                const rate = row.trades ? 100 * row.wins / row.trades : null;
                return <div key={id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <h3 className="font-black">{EMA_VARIANT_DETAILS[id].title}</h3>
                  <p className="mt-3 text-xs font-bold text-slate-500">勝率（決済済み）</p>
                  <p className="text-2xl font-black tabular-nums">{percent(rate == null ? null : Number(rate.toFixed(1)))}</p>
                  <p className="mt-1 text-sm">確定 {row.trades}回 / {row.wins}勝 {row.losses}敗 {row.flat}引分</p>
                  <p className="mt-3 text-xs font-bold text-slate-500">100株ごとの確定損益合計</p>
                  <p className={"text-xl font-black tabular-nums " + (row.pnl >= 0 ? "text-emerald-600" : "text-red-600")}>{money(row.pnl)}</p>
                  <p className="mt-2 text-sm">1取引平均：{row.trades ? money(row.pnl / row.trades) : "—"}</p>
                  <p className="mt-1 text-sm">平均騰落率：{row.trades ? percent(Number((row.totalReturn / row.trades).toFixed(2))) : "—"}</p>
                  <p className="mt-2 text-xs text-slate-500">取引成立 {row.sampleStocks} / {row.eligibleStocks}銘柄</p>
                  {row.trades < 30 && <p className="mt-2 text-xs font-bold text-amber-700">⚠ 30取引未満：参考値</p>}
                </div>;
              })}
            </div>
          </section>
          <section className="mt-6">
            <h2 className="text-xl font-black">🔍 銘柄別の比較</h2>
            <div className="mt-3 space-y-3">{studies.map((study) => <article key={study.code} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-black">{study.code} <span className="text-xs font-normal text-slate-500">・日足 {study.candles}本</span></h3>
                <Link href={"/admin/ema-signals"} className="text-sm font-bold text-blue-600">単一銘柄ページ →</Link>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                {EMA_VARIANT_IDS.map((id) => {
                  const row = study.results[id];
                  return <div key={id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                    <p className="text-sm font-black">{EMA_VARIANT_DETAILS[id].title}</p>
                    <p className="mt-2 text-sm">勝率：<b>{percent(row.stats.winRatePercent)}</b> （{row.stats.closedTrades}回）</p>
                    <p className={"mt-1 text-base font-black " + (row.stats.totalPnlYen >= 0 ? "text-emerald-600" : "text-red-600")}>{money(row.stats.totalPnlYen)}</p>
                    <p className="mt-1 text-xs text-slate-500">最悪取引：{row.stats.worstTradeYen == null ? "—" : money(row.stats.worstTradeYen)}</p>
                    <p className="mt-1 text-xs text-slate-500">確定DD：{fmt(row.stats.maxRealizedDrawdownYen)}円</p>
                    {row.openPosition && <p className="mt-1 text-xs text-blue-600">未決済：別集計（損益未算入）</p>}
                  </div>;
                })}
              </div>
            </article>)}</div>
          </section>
        </>}
        {studies.length === 0 && <p className="mt-4 text-sm font-bold text-slate-500">比較可能なデータがありません。銘柄コードや期間を変更してください。</p>}
      </>}

      <p className="mt-5 rounded-xl border border-slate-200 p-4 text-xs leading-6 text-slate-600 dark:border-slate-700 dark:text-slate-400">
        【検証の前提】すべての条件は買い交差が確定した当日までに得られる情報だけで判定し、売買の約定は翌営業日始値と仮定。条件不成立の買い交差を見送った場合、次の買い交差まで待ち、反対サインでは買いポジションがあるときのみ売却。
        比較した期間・銘柄で条件を選ぶと過剰最適化の恐れがあります。別期間・未検証銘柄・今後のデータで再検証が必要。基準は同額投資や時間あたりリターンではなく「各取引100株の仮想損益」。
        出来高未取得・BB計算不足のサインは候補外。AI POWERは過去判定時点の独立データとの照合が必要なため今回は未追加。実験室・DB・通知・AI判定・疑似購入は変更しません。
      </p>
    </div>
  </main>;
}
