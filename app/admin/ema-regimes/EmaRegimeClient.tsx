"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  EMA_RESEARCH_UNIVERSE, EMA_VALIDATION_CUTOFF, metric, summarizeEmaResearch,
} from "@/app/lib/emaRegimeResearch";
import type { EmaStudyInput, EmaStudyPhase, EmaTradeMetric, RegimeLabel, VolatilityLabel } from "@/app/lib/emaRegimeResearch";
import { EMA_VARIANT_IDS, EMA_VARIANT_DETAILS } from "@/app/lib/emaSignalComparison";
import type { EmaVariantId } from "@/app/lib/emaSignalComparison";
import type { EmaCandle } from "@/app/lib/emaCrossoverBacktest";

type Success = { success: true; code: string; range: "2y"; candles: EmaCandle[]; splitEvents?: number[] };
type Result = { code: string; input?: EmaStudyInput; error?: string };

const money = (value: number) => (value > 0 ? "+" : "") + value.toLocaleString("ja-JP", {maximumFractionDigits:2}) + "円";
const pct = (value: number | null) => value === null ? "—" : value.toFixed(1) + "%";
const trendLabel: Record<RegimeLabel, string> = {UP:"上昇基調", DOWN:"下降基調", SIDEWAYS:"方向感なし", UNKNOWN:"計算不足"};
const volatilityLabel: Record<VolatilityLabel, string> = { HIGH:"高ボラ（変動大）", LOW:"低ボラ（変動小）", UNKNOWN:"計算不足" };
const tabs: {id:EmaStudyPhase;label:string}[] = [
  {id:"ALL",label:"全期間"},
  {id:"TRAIN",label:"過去前半"},
  {id:"TEST",label:"過去後半（確認用）"},
];

function MetricView({label,data}: {label:string;data:EmaTradeMetric}) {
  return <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
    <h3 className="text-sm font-black">{label}</h3>
    <p className="mt-2 text-xs text-slate-500">勝率／確定取引数</p>
    <p className="text-xl font-black">{pct(data.winRatePercent)} <span className="text-sm font-medium">({data.trades}回)</span></p>
    <p className={"mt-2 text-lg font-black " + (data.pnlYen >= 0 ? "text-emerald-600" : "text-red-600")}>{data.trades > 0 ? money(data.pnlYen) : "—"}</p>
    <p className="mt-1 text-xs text-slate-500">平均損益率 {pct(data.averageReturnPercent)}</p>
    <p className="mt-1 text-xs text-slate-500">最悪取引 {data.worstYen === null ? "—" : money(data.worstYen)}</p>
    {data.trades < 30 && <p className="mt-2 text-xs font-bold text-amber-700">⚠ 30件未満・参考値</p>}
  </div>;
}

export default function EmaRegimeClient() {
  const [size, setSize] = useState<20|40>(20);
  const [sizeInRun, setSizeInRun] = useState<20|40>(20);
  const [run, setRun] = useState(0);
  const [items, setItems] = useState<Result[]>([]);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<EmaStudyPhase>("TEST");

  useEffect(() => {
    if (run === 0) return;
    const controller = new AbortController();
    const codes = EMA_RESEARCH_UNIVERSE.slice(0, sizeInRun).map((item) => item.code);
    const load = async () => {
      setBusy(true);
      setItems([]);
      setProgress(0);
      const completed: Result[] = [];
      // No background jobs: every search is explicit and limited to two calls at a time.
      for (let i = 0; i < codes.length && !controller.signal.aborted; i += 2) {
        const batch = await Promise.all(codes.slice(i, i + 2).map(async (code):Promise<Result> => {
          try {
            const r = await fetch("/api/admin/ema-signals?code=" + code + "&range=2y", {
              cache: "no-store", signal: controller.signal,
            });
            const json = await r.json();
            if (!r.ok || json.success !== true) throw new Error(json.error ?? "取得失敗");
            const d = json as Success;
            return {code, input: {code, candles:d.candles, splitEvents:d.splitEvents ?? []}};
          } catch (error) {
            return {code, error:controller.signal.aborted ? "中断" : error instanceof Error ? error.message : "取得失敗"};
          }
        }));
        if (controller.signal.aborted) break;
        completed.push(...batch);
        setItems([...completed]);
        setProgress(completed.length);
      }
      if (!controller.signal.aborted) setBusy(false);
    };
    void load();
    return () => controller.abort();
  }, [run, sizeInRun]);

  const validInputs = useMemo(() => items.flatMap((item) => item.input ? [item.input] : []), [items]);
  const research = useMemo(() => summarizeEmaResearch(validInputs), [validInputs]);
  const failed = items.filter((item) => !!item.error);
  const complete = run > 0 && !busy && progress === sizeInRun;
  const current = phase === "TRAIN" ? research.train : phase === "TEST" ? research.test : research.all;
  const regimes = phase === "TRAIN" ? research.regimesTrain : phase === "TEST" ? research.regimesTest : research.regimesAll;
  const universe = EMA_RESEARCH_UNIVERSE.slice(0,sizeInRun);

  return <main className="min-h-screen bg-slate-50 px-3 py-5 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/admin/ema-comparison" className="text-sm font-bold text-blue-600">← 4銘柄・条件比較に戻る</Link>
        <Link href="/admin/ema-stage5" className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-black text-violet-700">🚀 第5段階・複合条件＆リスク検証 →</Link>
      </div>
      <header className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <p className="text-xs font-black tracking-widest text-violet-600">ADMIN RESEARCH / SHADOW ONLY</p>
        <h1 className="mt-2 text-2xl font-black">🧪 EMA 銘柄適性・相場環境研究</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
          複数銘柄を固定リストで検証。買い交差した日の市場環境と、その後の決済成績を比較します。
          当日の終値でサイン判定し、翌営業日の始値で100株仮想売買。実取引には影響しません。
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm font-bold">
            対象（約2年・各銘柄の日足）
            <select disabled={busy} value={size} onChange={(e)=>setSize(Number(e.target.value) as 20|40)}
              className="min-h-12 rounded-xl border border-slate-300 bg-white px-3 text-slate-900 disabled:opacity-60">
              <option value={20}>20銘柄（推奨）</option>
              <option value={40}>40銘柄（時間がかかります）</option>
            </select>
          </label>
          <button type="button" disabled={busy} onClick={()=>{setSizeInRun(size);setRun((n)=>n+1);}}
            className="min-h-12 rounded-xl bg-violet-600 px-5 font-black text-white disabled:opacity-50">
            {busy ? "研究中…" : "研究を開始・再実行"}
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-500">データ取得はボタンを押した時だけ。2銘柄ずつ読み込み、DBへは保存しません。</p>
      </header>

      {run === 0 && <section className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-800">
        まず「研究を開始・再実行」を押してね。初回は20銘柄の比較を準備しています。
      </section>}
      {run > 0 && <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="font-black">📥 読み込み状況：{progress} / {sizeInRun}銘柄 {busy ? "（進行中）" : "（終了）"}</h2>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div className="h-full bg-violet-500" style={{width: (100*progress/sizeInRun)+"%"}} />
        </div>
        <p className="mt-2 text-xs text-slate-500">集計可能 {research.eligibleCount}件 / 価格要確認 {research.excludedCount}件 / 取得失敗 {failed.length}件</p>
        {failed.length > 0 && <p className="mt-2 text-sm text-amber-700">取得できなかった銘柄：{failed.map((item)=>item.code).join("、")}（比較対象から除外）</p>}
        {research.stocks.filter((item)=>item.reason).length > 0 && <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-black">⚠ 株式分割・異常値などで保留</p>
          <p className="mt-1">{research.stocks.filter((item)=>item.reason).map((item)=>item.code+" "+item.reason).join("／")}</p>
          <p className="mt-1 text-xs">調整済み価格の整合性が取れるまでは、保留銘柄の売買結果を集計に混ぜません。</p>
        </div>}
        {!complete && busy && <p className="mt-2 text-xs font-bold text-amber-700">読み込み中の集計値は暫定値。全件終了後に比較してください。</p>}
      </section>}

      {validInputs.length > 0 && research.eligibleCount > 0 && <>
        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-black">🗓️ 前半・後半の分割検証</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">固定の境界日：{EMA_VALIDATION_CUTOFF}。前半はその日より前に売却完了した取引、後半はその日以降に新規購入した取引。期間をまたいだ取引は双方から除外。</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {tabs.map((tab)=><button key={tab.id} onClick={()=>setPhase(tab.id)} type="button" aria-pressed={phase===tab.id}
              className={"rounded-xl px-3 py-2 text-sm font-black " + (phase===tab.id?"bg-blue-600 text-white":"bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-100")}>
              {tab.label}
            </button>)}
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {EMA_VARIANT_IDS.map((id:EmaVariantId)=><MetricView key={id} label={EMA_VARIANT_DETAILS[id].title} data={current[id]}/>)}
          </div>
          <p className="mt-2 text-xs text-slate-500">EMA単独で分割境界をまたいだ取引：{research.baselineAcrossBoundary}件（全期間の表示には含まれる）。前半は条件探し、後半は傾向の確認用。既に結果を見た後での検証なので、完全に独立した将来検証ではありません。</p>
        </section>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-black">🌤️ EMA単独・買い時の相場環境別</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">購入サイン日の情報だけで分類。上昇基調＝終値が75日平均より上かつ平均線が5日前より上。下降基調は逆。値動き＝過去20日の日次変化率標準偏差が2%以上なら高ボラ。</p>
          <h3 className="mt-4 font-bold">トレンド別の成績</h3>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {(["UP","DOWN","SIDEWAYS","UNKNOWN"] as const).map((id)=><MetricView key={id} label={trendLabel[id]} data={regimes.trend[id]}/>)}
          </div>
          <h3 className="mt-4 font-bold">値動きの大きさ別の成績</h3>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {(["HIGH","LOW","UNKNOWN"] as const).map((id)=><MetricView key={id} label={volatilityLabel[id]} data={regimes.volatility[id]}/>)}
          </div>
          <p className="mt-2 text-xs text-slate-500">この成績は「買う時点での分類」の後追い集計。フィルターによる実際の取引回数・利益改善を証明するものではありません。</p>
        </section>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-black">🎯 一部の銘柄への利益集中を監査</h2>
          <p className="mt-2 text-sm">EMA単独・全期間の合計：<b>{money(research.all.BASE.pnlYen)}</b></p>
          <p className="mt-2 text-sm">利益最大の銘柄：<b>{research.topStock?.code ?? "—"}</b>（{research.topStock ? money(research.topStock.pnl) : "—"}）</p>
          <p className="mt-2 text-sm">その1銘柄を除いた合計：<b className={research.profitExcludingTopYen >= 0?"text-emerald-600":"text-red-600"}>{money(research.profitExcludingTopYen)}</b></p>
          <p className="mt-2 text-xs text-slate-500">資金を同額にした評価ではありません。100株ずつの円損益は株価が高い銘柄に偏りやすいため、下の平均損益率と併せて確認してください。</p>
        </section>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-black">🔎 銘柄別成績（EMA単独）</h2>
          <p className="mt-1 text-xs text-slate-500">現在選択中：{tabs.find((tab)=>tab.id===phase)?.label} ／ 確定取引のみ。銘柄適性はまだ仮説の段階。</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[510px] text-left text-xs">
              <thead><tr className="border-b text-slate-500"><th className="p-2">銘柄</th><th className="p-2 text-right">取引</th><th className="p-2 text-right">勝率</th><th className="p-2 text-right">平均損益率</th><th className="p-2 text-right">100株損益</th></tr></thead>
              <tbody>{research.stocks.map((study)=>{
                const info = universe.find((u)=>u.code===study.code);
                const summary = metric(study.trades.BASE.filter((trade)=>phase==="ALL"|| (phase==="TRAIN"?trade.exitTime<Date.parse(EMA_VALIDATION_CUTOFF+"T00:00:00Z")/1000:trade.entryTime>=Date.parse(EMA_VALIDATION_CUTOFF+"T00:00:00Z")/1000)));
                return <tr key={study.code} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="p-2 font-bold">{study.code} <span className="font-normal text-slate-500">{info?.name}</span>{study.reason && <span className="block text-amber-700">確認待ち</span>}</td>
                  <td className="p-2 text-right">{study.reason ? "—" : summary.trades}</td>
                  <td className="p-2 text-right">{study.reason ? "—" : pct(summary.winRatePercent)}</td>
                  <td className="p-2 text-right">{study.reason ? "—" : pct(summary.averageReturnPercent)}</td>
                  <td className={"p-2 text-right font-bold "+(summary.pnlYen>=0?"text-emerald-600":"text-red-600")}>{study.reason||!summary.trades?"—":money(summary.pnlYen)}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
          {complete && research.eligibleCount < 10 && <p className="mt-3 text-sm font-bold text-amber-700">⚠ 集計できた銘柄が10件未満です。全体傾向の判断には不十分です。</p>}
        </section>
      </>}

      <footer className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-6 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
        研究用途／管理者限定／保存なし。Yahoo日足のOHLCから算出。分割記録や前日終値との大幅ギャップ（始値比1.5倍超・0.67倍未満）は安全のため保留し、調整価格を未検証のまま成績に混入しません。固定の20/40銘柄は無作為抽出ではなく、生存バイアスがあります。
        約2年、株価の取得失敗・データ不足は除外。売買は買い交差の翌営業日始値から売り交差の翌営業日始値まで、100株・空売りなし。手数料、税金、スリッページ、配当、資金拘束は考慮していません。
        実験室、AI POWER、LINE通知、疑似購入、DB、Cronに変更なし。サンプルが少ない分類を優秀と決めつけず、後日新しく貯まるデータで再検証する必要があります。
      </footer>
    </div>
  </main>;
}
