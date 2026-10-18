import Link from "next/link";
import BottomNav from "@/app/components/BottomNav";
import CrashStrengthDashboardTabs from "./CrashStrengthDashboardTabs";
import CrashBenchmarkCards from "./CrashBenchmarkCards";
import { notFound } from "next/navigation";
import pool from "@/app/lib/postgres";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import { jstToday } from "@/app/lib/learning/priceReferenceObservations";
import { analyzeCrashStrength } from "@/app/lib/research/crashStrengthShadow.mjs";
import { getCrashMarketReferences } from "@/app/lib/research/crashStrengthMarketReferenceRunner";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type Stock = {
  code: string; name: string; price: number; cost100: number;
  dailyReturn: number; excessReturn: number;
  after1: number | null; after3: number | null; after5: number | null;
  historical1?: { sampleCount: number; average1: number | null; positiveRate1: number | null };
};
type GroupStats = { eventCount: number; sampleCount: number; average1: number | null; positiveRate1: number | null };
type Event = { date: string; previousDate: string; benchmark: string; indexReturn: number;
  nikkeiReturn: number | null; topixReturn: number | null };
type Recent = { event: Event; examinedStocks: number; isLatestSavedDate: boolean;
  strong: Stock[]; weak: Stock[] };
type NextDayEntry = {
  code: string; name: string; referencePrice: number; cost100: number;
  latestShockReturn: number; latestRelativeReturn: number;
  sampleCount: number; upCount: number; downCount: number;
  positiveRate1: number; average1: number; median1: number;
  worst1: number; best1: number;
  benchmarkSampleCount: number; outperformedCount: number;
  benchmarkBeatRate: number | null; benchmarkAverage1: number | null; benchmarkStockAverage1: number | null;
  averageExcess1: number | null; worstExcess1: number | null;
};
type NextDayEvidence = {
  selectedDate: string; settledPastEpisodes: number; cohortCount: number;
  eligibleCount: number; minSamples: number;
  leaders: NextDayEntry[]; laggers: NextDayEntry[]; note: string;
  benchmarkEligibleCount: number;
  benchmarkLeaders: NextDayEntry[]; benchmarkLaggers: NextDayEntry[];
  retrospectiveReplay: {
    status: string; nextSessionDate: string | null; indexReturn1: number | null;
    leaders: {eligibleShown:number;observedCount:number;beatCount:number;beatRate:number;averageExcess:number}|null;
    laggers: {eligibleShown:number;observedCount:number;beatCount:number;beatRate:number;averageExcess:number}|null;
  };
};
type Report = {
  version: string; asOf: string; eventCount: number; examinedStocks?: number;
  reference: { source: string; nikkeiAvailable: boolean; topixAvailable: boolean;
    referenceAvailable: boolean; note: string };
  recent: Recent | null;
  nextDayEvidence?: NextDayEvidence | null;
  coverage: { validSavedDays: number; minimumStocksPerDay: number; latestSavedDate: string | null; source: string;
    marketSessions: number; excludedSavedNonTradingDays: number; excludedSavedDates: string[] };
  event: Event | null;
  strong: Stock[]; weak: Stock[];
  historical: { strong: GroupStats; weak: GroupStats } | null; note: string;
};

function percent(value: number | null) {
  return value === null || !Number.isFinite(Number(value))
    ? "未観測" : `${Number(value) > 0 ? "+" : ""}${Number(value).toFixed(2)}%`;
}
function yen(value: number) { return Math.round(value).toLocaleString("ja-JP") + "円"; }
function PriceChange({value}: {value:number|null}) {
  return <span className={value === null ? "text-slate-400" : value >= 0 ? "text-emerald-700" : "text-red-700"}>
    {percent(value)}</span>;
}
function Ranking({title, side, rows, context="crash"}: {
  title:string;side:"strong"|"weak";rows:Stock[];context?:"crash"|"routine"
}) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <h2 className="text-xl font-black">{title}</h2>
    <p className="mt-1 text-xs text-slate-500">{context==="crash"
      ? "急落当日の市場平均との差で並び替え。未来の値上がり・値下がり順ではありません。"
      : "直近の保存日における市場比ランキング。下位でも株価が上昇している場合があります。翌日の予測順位ではありません。"}</p>
    {rows.length === 0 ? <p className="mt-4 text-sm text-slate-500">条件に該当する銘柄がありません。</p> :
    <div className="mt-3 space-y-2">{rows.map((r, i) => <article key={r.code} className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-black">{i + 1}. {r.name} <span className="font-normal text-slate-500">({r.code})</span></p>
          <p className="mt-1 text-xs text-slate-500">保存参考価格 {yen(r.price)} ｜ 100株 {yen(r.cost100)}</p>
        </div>
        <Link href={`/chart/${r.code}`} className="shrink-0 rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">CHART →</Link>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-2 text-sm">
        <div><p className="text-xs text-slate-500">当日騰落</p><b><PriceChange value={r.dailyReturn}/></b></div>
        <div><p className="text-xs text-slate-500">市場比（相対強弱）</p><b><PriceChange value={r.excessReturn}/></b></div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <div>翌取引日 <b className="block"><PriceChange value={r.after1}/></b></div>
        <div>3取引日後 <b className="block"><PriceChange value={r.after3}/></b></div>
        <div>5取引日後 <b className="block"><PriceChange value={r.after5}/></b></div>
      </div>
      {context==="crash" && r.historical1 && <p className="mt-2 text-xs text-slate-500">
        過去の同銘柄・同分類 {r.historical1.sampleCount}件：
        {r.historical1.average1 === null ? "検証件数不足（5件未満）" :
        `翌日平均 ${percent(r.historical1.average1)} ／ 上昇率 ${r.historical1.positiveRate1}%`}
      </p>}
    </article>)}</div>}
    <p className="mt-3 text-xs text-slate-500">{context==="crash"
      ? (side==="strong" ? "急落日の相対強度 +0.5ポイント以上を上位20件" : "急落日の相対強度 −0.5ポイント以下を下位20件")
      : (side==="strong" ? "市場比上位20件" : "市場比下位20件")}</p>
  </section>;
}

function NextDayEvidenceList({title,rows,isUp}: {
  title: string; rows: NextDayEntry[]; isUp: boolean;
}) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
    <h3 className="px-1 pb-2 text-lg font-black">{title}</h3>
    <p className="px-1 pb-2 text-xs leading-5 text-slate-500">
      {isUp ? "過去の上昇割合が高い順" : "過去の上昇割合が低い順"}。勝率が同じ場合は平均騰落率で並び替え。</p>
    <div className="space-y-2">{rows.map((stock,index)=><article key={stock.code}
      className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-black">{index+1}. {stock.name} <span className="text-sm font-normal text-slate-500">({stock.code})</span></p>
          <p className="mt-1 text-xs text-slate-500">100株参考額 {yen(stock.cost100)}</p>
        </div>
        <Link href={`/chart/${stock.code}`} className="shrink-0 rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">CHART →</Link>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-2">
        <div><p className="text-xs text-slate-500">過去の翌日上昇率</p>
          <p className="text-lg font-black">{stock.positiveRate1.toFixed(1)}%</p>
          <p className="text-xs text-slate-500">{stock.upCount}勝 / {stock.sampleCount}件</p></div>
        <div><p className="text-xs text-slate-500">翌日平均騰落率</p>
          <p className="text-lg font-black"><PriceChange value={stock.average1}/></p>
          <p className="text-xs text-slate-500">最悪 <PriceChange value={stock.worst1}/></p></div>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        最新急落日の市場比 <PriceChange value={stock.latestRelativeReturn}/>
        {" ｜ "}過去中央値 <PriceChange value={stock.median1}/>
      </p>
    </article>)}</div>
  </div>;
}

function BenchmarkEvidenceList({title,rows}: {title:string;rows:NextDayEntry[]}) {
  return <div className="rounded-2xl border border-indigo-200 bg-white p-3">
    <h3 className="text-lg font-black">{title}</h3>
    <p className="mt-1 text-xs leading-5 text-slate-500">
      同じ翌取引日の日経平均を上回った割合で順位付け。勝率同点なら市場超過平均で比較。</p>
    <div className="mt-3 space-y-2">{rows.map((stock,i)=><div key={stock.code}
      className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="font-black">{i+1}. {stock.name} <span className="text-sm font-normal text-slate-500">({stock.code})</span></p>
        <Link href={`/chart/${stock.code}`}
          className="shrink-0 rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">CHART →</Link>
      </div>
      <p className="mt-1 text-xs text-slate-500">100株参考額 {yen(stock.cost100)}</p>
      <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-2">
        <div><p className="text-xs text-slate-600">日経平均を上回った割合</p>
          <p className="text-lg font-black">{stock.benchmarkBeatRate?.toFixed(1)}%</p>
          <p className="text-xs">{stock.outperformedCount}回 / {stock.benchmarkSampleCount}件</p></div>
        <div><p className="text-xs text-slate-600">市場超過・翌日平均</p>
          <p className="text-lg font-black"><PriceChange value={stock.averageExcess1}/></p>
          <p className="text-xs">最悪 <PriceChange value={stock.worstExcess1}/></p></div>
      </div>
      <p className="mt-2 text-xs text-slate-600">同じ日の株の平均 <PriceChange value={stock.benchmarkStockAverage1}/> ／
        日経平均の同日平均 <PriceChange value={stock.benchmarkAverage1}/></p>
    </div>)}</div>
  </div>;
}

function ReplayStatus({data}: {data: NextDayEvidence["retrospectiveReplay"]}) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-4">
    <h3 className="text-lg font-black">🧪 最新急落日の事後再現チェック</h3>
    <p className="mt-2 text-xs leading-6 text-slate-600">
      最新急落日までの情報だけで計算した過去の順位を、判明済みの翌取引日と照合します。
      これは過去のデータを用いた事後再計算であり、当時候補を事前保存した実証ではありません。</p>
    {data.status!=="RETROSPECTIVE_ONLY" ?
      <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm">翌取引日の日経平均または保存株価が未確定のため、検証待ちです。</p> :
      <>
        <p className="mt-2 text-sm">照合日：{data.nextSessionDate} ／ 日経平均 <PriceChange value={data.indexReturn1}/></p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {(["leaders","laggers"] as const).map(side=>{
            const x=data[side];
            return <div key={side} className="rounded-xl bg-slate-50 p-3">
              <p className="font-black">{side==="leaders"?"過去優勢グループ":"過去劣勢グループ"}</p>
              {!x?<p className="mt-2 text-xs">照合不可（未保存）</p>:<>
                <p className="mt-2 text-xs">上回った {x.beatCount}/{x.observedCount}件
                  （対象表示数{x.eligibleShown}）</p>
                <p className="text-sm">市場超過率 <b>{x.beatRate.toFixed(1)}%</b></p>
                <p className="text-sm">市場超過平均 <b><PriceChange value={x.averageExcess}/></b></p>
              </>}
            </div>;
          })}
        </div>
      </>}
    <p className="mt-3 text-xs text-amber-700">今後の真の事前固定検証には、選定日時と候補・算出元を独立保存する機能が必要です。ここではまだ実施していません。</p>
  </section>;
}

function NextDayEvidencePanel({data}: {data: NextDayEvidence | null | undefined}) {
  if (!data) return null;
  return <section className="space-y-3 rounded-2xl border border-indigo-200 bg-indigo-50/30 p-3">
    <div className="rounded-xl bg-white p-4">
      <p className="text-xs font-black tracking-wide text-indigo-700">PRIVATE / HISTORICAL EVIDENCE</p>
      <h2 className="mt-2 text-xl font-black">🏅 暴落翌日・上昇実績ランキング</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        {data.selectedDate}の急落日に記録された{data.cohortCount}銘柄を対象に、
        その日より前の急落後実績だけで集計します。翌日に上がりやすかった銘柄と
        下がりやすかった銘柄を分けて比較します。</p>
      <p className="mt-2 text-xs text-slate-600">
        過去の集計対象 {data.settledPastEpisodes}急落日 ／ 同一銘柄で{data.minSamples}件以上確認できた銘柄
        <b className="ml-1">{data.eligibleCount}件</b>
      </p>
      <p className="mt-2 text-xs font-bold text-amber-700">
        暫定研究：勝率100％でも少数回なら不確実です。計算には指数の実取引日だけを使用。
        過去の実績であり、明日の上昇予測・買い推奨ではありません。
      </p>
    </div>
    {data.eligibleCount > 0 ?
      <div className="grid gap-3 lg:grid-cols-2">
        <NextDayEvidenceList title="🟢 過去の翌日上昇率・上位20" rows={data.leaders} isUp={true}/>
        <NextDayEvidenceList title="🔴 過去の翌日上昇率・下位20" rows={data.laggers} isUp={false}/>
      </div> :
      <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
        まだ5件以上の過去の急落後実績がある銘柄を確認できません。
        銘柄別の勝率は推測せず、追加のデータを待ちます。
      </p>}

    <p className="px-2 pb-1 text-xs leading-6 text-slate-600">{data.note}</p>
  </section>;
}


function CompactBenchmark({title,rows}: {title:string;rows:NextDayEntry[]}) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
    <h3 className="text-lg font-black">{title}</h3>
    <p className="mt-1 text-xs text-slate-500">日経平均を上回った回数と翌日の平均超過率で比較。過去実績であり予測ではありません。</p>
    {rows.length===0?<p className="mt-3 text-sm text-slate-500">検証件数不足・表示対象なし</p>:
    <div className="mt-2 divide-y divide-slate-100">
      {rows.slice(0,3).map((s,i)=><div key={s.code} className="grid grid-cols-[minmax(0,1fr)_80px_78px] items-center gap-1.5 py-3">
        <div className="min-w-0">
          <p className="text-sm font-black">{i+1}. {s.name}</p>
          <Link href={"/chart/"+s.code} className="text-xs font-bold text-blue-700">{s.code}・CHART →</Link>
        </div>
        <div className="text-right text-sm font-black">{s.benchmarkBeatRate?.toFixed(1)}%<p className="text-[10px] font-normal text-slate-500">{s.outperformedCount}/{s.benchmarkSampleCount}件</p></div>
        <p className="text-right text-sm font-black"><PriceChange value={s.averageExcess1}/></p>
      </div>)}
    </div>}
    {rows.length>3&&<details className="mt-3 rounded-lg border border-blue-100 p-2">
      <summary className="cursor-pointer text-center text-sm font-black text-blue-700">もっと見る（全{rows.length}銘柄）</summary>
      <div className="mt-3"><BenchmarkEvidenceList title={title} rows={rows}/></div>
    </details>}
  </section>;
}
function CompactNextDay({title,rows,isUp}: {title:string;rows:NextDayEntry[];isUp:boolean}) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-3">
    <h3 className="text-lg font-black">{title}</h3>
    <div className="mt-2 divide-y divide-slate-100">
      {rows.slice(0,3).map((s,i)=><div key={s.code} className="grid grid-cols-[minmax(0,1fr)_75px_80px] items-center gap-2 py-3">
        <div className="min-w-0"><p className="text-sm font-black">{i+1}. {s.name}</p>
          <Link href={"/chart/"+s.code} className="text-xs text-blue-700">{s.code}・CHART →</Link></div>
        <p className="text-right text-sm font-black">{s.positiveRate1.toFixed(1)}%<span className="block text-[10px] font-normal text-slate-500">{s.sampleCount}件</span></p>
        <p className="text-right text-sm font-black"><PriceChange value={s.average1}/></p>
      </div>)}
    </div>
    {rows.length>3&&<details className="mt-3 rounded-lg border border-blue-100 p-2">
      <summary className="cursor-pointer text-center text-sm font-black text-blue-700">もっと見る（全{rows.length}銘柄）</summary>
      <div className="mt-3"><NextDayEvidenceList title={title} rows={rows} isUp={isUp}/></div>
    </details>}
  </section>;
}
function CompactStock({title,rows,side,context}:{
  title:string;rows:Stock[];side:"strong"|"weak";context:"crash"|"routine"
}) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-3">
    <h3 className="text-lg font-black">{title}</h3>
    <p className="mt-1 text-xs text-slate-500">市場比の相対騰落率。翌日の予測順位ではありません。</p>
    <div className="mt-2 divide-y divide-slate-100">
      {rows.slice(0,3).map((s,i)=><div key={s.code} className="flex items-center justify-between gap-2 py-3">
        <div className="min-w-0">
          <p className="text-sm font-black">{i+1}. {s.name} <span className="font-normal text-slate-500">({s.code})</span></p>
          <p className="text-xs text-slate-500">100株 {yen(s.cost100)}</p>
        </div>
        <span className="shrink-0 text-sm font-black"><PriceChange value={s.excessReturn}/></span>
        <Link href={"/chart/"+s.code} className="shrink-0 text-xs font-black text-blue-700">CHART →</Link>
      </div>)}
      {!rows.length&&<p className="py-3 text-sm text-slate-500">対象データなし</p>}
    </div>
    {rows.length>3&&<details className="mt-3 rounded-lg border border-blue-100 p-2">
      <summary className="cursor-pointer text-center text-sm font-black text-blue-700">もっと見る（全{rows.length}銘柄）</summary>
      <div className="mt-3"><Ranking title={title} rows={rows} side={side} context={context}/></div>
    </details>}
  </section>;
}

async function getReport(): Promise<Report> {
  const today = jstToday();
  const since = new Date(Date.parse(today + "T00:00:00Z") - 145 * 86400000).toISOString().slice(0, 10);
  // Reads only. Never writes or requests an external provider.
  const [reference, stock] = await Promise.all([
    getCrashMarketReferences(today),
    pool.query(`WITH valid_days AS (
        SELECT date FROM public.daily_stock_results
        WHERE date >= $1 AND date < $2 AND price > 0
        GROUP BY date
        HAVING COUNT(DISTINCT code) BETWEEN 800 AND 1500
        ORDER BY date DESC LIMIT 85
      )
      SELECT DISTINCT ON (d.date, d.code) d.date, d.code, d.name, d.price
      FROM public.daily_stock_results d
      INNER JOIN valid_days v ON v.date = d.date
      WHERE d.price > 0 AND d.code ~ '^[0-9]{4}$'
      ORDER BY d.date, d.code, d.created_at DESC`, [since, today]),
  ]);
  const result = analyzeCrashStrength({marketRows:reference.marketRows,priceRows:stock.rows,asOf:today});
  return { ...result, reference } as Report;
}

export default async function CrashStrengthShadowPage() {
  const { isOwner, email } = await getLearningOwnerSession();
  // Preview deployments use a different cookie origin than production. Do not
  // turn a missing session into an unexplained 404. This branch performs no DB
  // read until the configured single owner has authenticated successfully.
  if (!email) {
    return <main className="min-h-screen bg-slate-50 px-4 py-16 text-slate-950">
      <section className="mx-auto max-w-lg rounded-2xl border bg-white p-6 shadow-sm">
        <p className="text-xs font-black text-indigo-700">SIGNALX PRIVATE RESEARCH</p>
        <h1 className="mt-3 text-2xl font-black">📉 暴落後・強弱ランキング</h1>
        <p className="mt-4 text-sm leading-7 text-slate-700">このページは本人専用です。現在のURLではログインを確認できませんでした。</p>
        <p className="mt-2 text-sm leading-7 text-slate-700">Vercel Previewと通常のSIGNALXではログイン状態が共有されません。Preview側でログインしてください。Previewの認証環境が未設定の場合は、通常のSIGNALXへの安全な公開後に確認できます。</p>
        <Link href="/login"
          className="mt-5 block rounded-xl bg-indigo-700 px-4 py-3 text-center text-sm font-bold text-white">Previewでログインする →</Link>
        <p className="mt-3 text-xs leading-6 text-slate-600">ログイン後はダッシュボードに移動します。その後、このPreviewのランキングURLをもう一度開いてください。</p>
        <p className="mt-4 text-xs text-slate-500">ログインしても指定された本人アカウント以外はランキングデータにアクセスできません。既存AI・注文・通知は変更しません。</p>
      </section>
    </main>;
  }
  if (!isOwner) notFound();
  let report: Report | null = null;
  try { report = await getReport(); }
  catch (error) { console.error("[crash-strength-shadow] read-only report unavailable", error); }
  return <main className="min-h-screen bg-slate-50 px-2 pb-28 pt-3 text-slate-950">
    <div className="mx-auto max-w-6xl space-y-2">
      <header className="px-1 pb-1">
        <Link href="/admin/learning-hub" className="text-sm font-black text-blue-700">← 学習管理室</Link>
        <p className="mt-2 text-[10px] font-black tracking-widest text-slate-500">SIGNALX PRIVATE / SHADOW RESEARCH</p>
        <h1 className="mt-1 text-[22px] font-black leading-tight tracking-tight sm:text-3xl">暴落後・強弱ランキング</h1>
        <p className="mt-1 text-[11px] leading-5 text-slate-600">
          保存済み株価と日経平均・TOPIXの参考日足を比較。暴落後の強さ・弱さを分析する本人専用研究画面です。
        </p>
      </header>
      {!report ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">研究データを取得できませんでした。既存のデータは変更していません。</p> : <>
        <section aria-label="研究サマリー"
          className="grid grid-cols-4 gap-1.5 rounded-2xl border border-blue-200 bg-blue-50/60 p-1.5">
          {[
            {icon:"▦",label:"急落日",value:report.event?.date??"未検出",tone:"text-blue-700"},
            {icon:"↘",label:"日経平均",value:report.event?percent(report.event.nikkeiReturn):"未観測",tone:"text-rose-700"},
            {icon:"♙",label:"判定対象",value:(report.examinedStocks??0)+"銘柄",tone:"text-blue-700"},
            {icon:"▤",label:"有効保存日",value:report.coverage.validSavedDays+"日",tone:"text-blue-700"}
          ].map(x=><div key={x.label} className="min-w-0 rounded-xl bg-white px-1 py-2 text-center">
            <p aria-hidden="true" className="text-sm font-black leading-4 text-blue-600">{x.icon}</p>
            <p className="mt-1 whitespace-nowrap text-[9px] font-black text-slate-500 sm:text-xs">{x.label}</p>
            <p className={"mt-1 whitespace-nowrap text-[11px] font-black sm:text-base "+x.tone}>{x.value}</p>
          </div>)}
        </section>
        <CrashStrengthDashboardTabs
          overview={<div className="space-y-3">
            <Link href="/admin/crash-strength/forward"
              className="block rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-black text-emerald-900">
              🟢🔄 暴落耐性・急反発候補の事前固定検証を見る →
              <span className="mt-1 block text-xs font-normal text-slate-600">次の急落日に自動で候補を固定。翌取引日以降に実績を照合します。</span>
            </Link>
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="text-xl font-black">📊 市場の暴落判定</h2>
              <p className="mt-1 text-xs text-slate-600">参考指数：日経平均 {report.reference.nikkeiAvailable?"取得済み":"未取得"} ／ TOPIX {report.reference.topixAvailable?"取得済み":"未取得"}</p>
              {report.event ? <>
                <p className="mt-3 text-2xl font-black text-rose-700">{report.event.date} ｜ {report.event.benchmark} {percent(report.event.indexReturn)}</p>
                <p className="mt-2 text-sm">日経平均 <PriceChange value={report.event.nikkeiReturn}/> ／ TOPIX <PriceChange value={report.event.topixReturn}/></p>
                <p className="mt-2 text-xs text-slate-600">過去の急落 {report.eventCount}日 ／ 判定対象 {report.examinedStocks}銘柄。直近の保存日と同じ日とは限りません。</p>
              </> : <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                {report.reference.referenceAvailable?"条件に合う急落日が確認できません。未検出は安全の保証ではありません。":"指数を取得できず判定保留です。"}
              </p>}
            </section>
            <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-xs leading-6 text-slate-700">
              <h2 className="text-base font-black">📅 取引日照合</h2>
              <p>有効保存日 {report.coverage.validSavedDays}日 ／ 休場日等の保存日除外 {report.coverage.excludedSavedNonTradingDays}日</p>
              {!!report.coverage.excludedSavedDates.length&&<p>除外例：{report.coverage.excludedSavedDates.join("・")}</p>}
              <p>日経平均等の実取引日に合わせて照合し、株価の欠損は補完しません。保存元は変更しません。</p>
            </section>
            {report.nextDayEvidence&&<ReplayStatus data={report.nextDayEvidence.retrospectiveReplay}/>}
          </div>}
          nextday={<div className="space-y-3">
            <div className="rounded-2xl border border-indigo-100 bg-white p-4">
              <h2 className="text-xl font-black">🏅 暴落翌日・上昇実績</h2>
              <p className="mt-1 text-xs text-slate-600">過去の独立した急落日の実績。上昇率100％でも将来の上昇は保証されません。</p>
              {report.nextDayEvidence&&<p className="mt-2 text-xs">比較対象 {report.nextDayEvidence.cohortCount}銘柄 ／ 過去 {report.nextDayEvidence.settledPastEpisodes}急落日 ／ 検証可能 {report.nextDayEvidence.eligibleCount}銘柄</p>}
            </div>
            {report.nextDayEvidence ? <div className="grid gap-3 lg:grid-cols-2">
              <CompactNextDay title="🟢 翌日上昇率・上位20" rows={report.nextDayEvidence.leaders} isUp={true}/>
              <CompactNextDay title="🔴 翌日上昇率・下位20" rows={report.nextDayEvidence.laggers} isUp={false}/>
            </div>:<p className="rounded-xl bg-amber-50 p-4 text-sm">過去の急落日データが不足しています。</p>}
          </div>}
          market={<div className="space-y-2">
            <h2 className="sr-only">日経平均に勝った銘柄ランキング</h2>
            {report.nextDayEvidence&&report.nextDayEvidence.benchmarkEligibleCount>0?
              <CrashBenchmarkCards
                strong={report.nextDayEvidence.benchmarkLeaders}
                weak={report.nextDayEvidence.benchmarkLaggers}
              />:<p className="rounded-xl bg-amber-50 p-3 text-sm">日経平均と照合できた急落後データが不足しています。</p>}
            {report.nextDayEvidence&&<details className="rounded-xl border border-blue-100 bg-white p-3">
              <summary className="cursor-pointer text-xs font-black text-blue-700">🧪 最新急落日の事後再現チェック</summary>
              <div className="mt-2"><ReplayStatus data={report.nextDayEvidence.retrospectiveReplay}/></div>
            </details>}
          </div>}
          intraday={<div className="space-y-3">
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="text-xl font-black">📉 暴落当日・直近の相対強弱</h2>
              <p className="mt-1 text-xs text-slate-600">市場平均との差を比較。翌日の予測とは異なります。</p>
            </section>
            {report.event&&<div className="grid gap-3 lg:grid-cols-2">
              <CompactStock title="🟢 暴落日に強かった銘柄" rows={report.strong} side="strong" context="crash"/>
              <CompactStock title="🔴 暴落日に弱かった銘柄" rows={report.weak} side="weak" context="crash"/>
            </div>}
            {report.recent?<section className="space-y-3">
              <div className="rounded-xl border border-blue-100 bg-white p-3">
                <h3 className="font-black">📊 直近の比較：{report.recent.event.date}</h3>
                <p className="mt-1 text-xs">市場 {report.recent.event.benchmark} <PriceChange value={report.recent.event.indexReturn}/> ／ 比較 {report.recent.examinedStocks}銘柄</p>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                <CompactStock title="🟢 直近・市場より強い上位" rows={report.recent.strong} side="strong" context="routine"/>
                <CompactStock title="🔴 直近・市場より弱い下位" rows={report.recent.weak} side="weak" context="routine"/>
              </div>
            </section>:<p className="rounded-xl bg-amber-50 p-3 text-sm">直近の相対強弱データはまだありません。</p>}
          </div>}
          notes={<div className="space-y-3">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-7">
              <h2 className="text-xl font-black">📋 研究上の注意点</h2>
              <p className="mt-2">🔒 本人専用・読み取り専用。AI判定、LINE通知、売買注文や元の保存データは変更していません。</p>
              <p>過去6勝6敗など少数回の結果だけでは、次の上昇・下落は予測できません。多数の銘柄から成績の良い銘柄を選ぶ偏りにも注意してください。</p>
              <p>参考指数と株価は保存済みの参考終値であり、実際の注文価格や約定可否を保証しません。休場日を除外し、欠損日は補完しません。</p>
              <p>最新急落日の事後再現は、当時の候補を事前保存した検証ではありません。</p>
              <p className="mt-3 text-xs text-slate-500">研究版 {report.version} ／ 最終保存日 {report.coverage.latestSavedDate??"不明"} ／ {report.reference.source}</p>
              <p className="text-xs text-slate-500">{report.note}</p>
              <p className="mt-2 text-xs font-bold text-amber-700">投資判断はご自身で。ランキングは買い推奨・利益保証ではありません。</p>
            </section>
            {report.event&&<section className="rounded-2xl border bg-white p-4">
              <h3 className="font-black">過去の急落後・翌日結果（全体統計）</h3>
              {(["strong","weak"] as const).map(key=>{
                const s=report.historical?.[key];
                return <p key={key} className="mt-2 text-xs">
                  {key==="strong"?"相対的に強い群":"相対的に弱い群"}：
                  {s?.eventCount??0}急落日／{s?.sampleCount??0}件 ／
                  翌日平均 {s?.average1==null?"検証中":percent(s.average1)} ／
                  上昇率 {s?.positiveRate1==null?"検証中":s.positiveRate1+"%"}
                </p>;
              })}
            </section>}
          </div>}
        />
      </>}
    </div>
    <BottomNav/>
  </main>;
}
