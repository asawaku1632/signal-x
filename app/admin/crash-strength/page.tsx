import Link from "next/link";
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
};
type NextDayEvidence = {
  selectedDate: string; settledPastEpisodes: number; cohortCount: number;
  eligibleCount: number; minSamples: number;
  leaders: NextDayEntry[]; laggers: NextDayEntry[]; note: string;
};
type Report = {
  version: string; asOf: string; eventCount: number; examinedStocks?: number;
  reference: { source: string; nikkeiAvailable: boolean; topixAvailable: boolean;
    referenceAvailable: boolean; note: string };
  recent: Recent | null;
  nextDayEvidence?: NextDayEvidence | null;
  coverage: { validSavedDays: number; minimumStocksPerDay: number; latestSavedDate: string | null; source: string };
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
        <div>翌営業日相当 <b className="block"><PriceChange value={r.after1}/></b></div>
        <div>3保存日後 <b className="block"><PriceChange value={r.after3}/></b></div>
        <div>5保存日後 <b className="block"><PriceChange value={r.after5}/></b></div>
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
        暫定研究：少数回の勝率は偶然でも高くなります。過去の実績であり、明日の上昇予測・買い推奨ではありません。
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
  return <main className="min-h-screen bg-slate-50 px-3 py-5 text-slate-950">
    <div className="mx-auto max-w-6xl space-y-4">
      <header className="rounded-2xl border border-slate-200 bg-white p-5">
        <Link href="/admin/learning-hub" className="text-sm font-bold text-blue-700">← 学習管理室</Link>
        <p className="mt-4 text-xs font-black tracking-widest text-indigo-700">SIGNALX PRIVATE / SHADOW RESEARCH</p>
        <h1 className="mt-2 text-2xl font-black">📉 暴落後・強弱ランキング</h1>
        <p className="mt-2 text-sm text-slate-600">Yahoo Financeの日経平均・TOPIX参考日足と、約1,000銘柄の保存済み日次参考価格を照合。
        急落日のランキングと通常日の市場比ランキングを分けて研究します。</p>
        <p className="mt-2 text-xs font-bold text-amber-700">🔒 本人専用・読み取り専用・既存AI判定/LINE通知/注文は変更しません</p>
      </header>
      {!report ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">研究用データを取得できませんでした。既存データは変更していません。</p> : <>
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-black">市場の暴落判定</h2>
          <p className="mt-2 text-xs text-slate-500">参考指数：日経平均 {report.reference.nikkeiAvailable?"取得済み":"未取得"} ／ TOPIX {report.reference.topixAvailable?"取得済み":"未取得"}</p>
          {report.event ? <>
            <p className="mt-2 text-2xl font-black text-red-700">{report.event.date} ｜ {report.event.benchmark} {percent(report.event.indexReturn)}</p>
            <p className="mt-2 text-sm">日経平均 <PriceChange value={report.event.nikkeiReturn}/> ／ TOPIX <PriceChange value={report.event.topixReturn}/></p>
            <p className="mt-2 text-sm text-slate-600">条件：日経平均またはTOPIXが前保存日比−2％以下。
              {report.coverage.latestSavedDate !== report.event.date ? " 最新の保存日とは異なる過去の急落記録です。" : " 直近の有効保存日に該当しています。"}</p>
            <p className="mt-2 text-xs text-slate-500">判定対象 {report.examinedStocks}銘柄 ／ 有効保存日 {report.coverage.validSavedDays}日 ／ 急落記録 {report.eventCount}日</p>
          </> : <p className="mt-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{report.reference.referenceAvailable
            ? "直近の保存データと参考指数を照合しましたが、判定条件（−2％以下・800銘柄以上）に合う急落日を確認できません。未検出は安全の保証ではありません。"
            : "日経平均・TOPIXの参考指数を取得できず、暴落判定を保留しています。これは『暴落がない』という意味ではありません。"}</p>}
        </section>
        <NextDayEvidencePanel data={report.nextDayEvidence}/>
        {report.event && <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Ranking title="🟢 暴落日に相対的に強かった銘柄" side="strong" rows={report.strong}/>
            <Ranking title="🔴 暴落日に相対的に弱かった銘柄" side="weak" rows={report.weak}/>
          </div>
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-lg font-black">過去の急落後・翌日結果</h2>
            <p className="mt-2 text-xs text-slate-500">最新の急落日より前に確定したデータだけを集計。5日以上の独立した急落日かつ30件以上の観測まで成績非表示。</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {(["strong","weak"] as const).map(key => {
                const s = report?.historical?.[key];
                return <div key={key} className="rounded-xl bg-slate-50 p-3">
                  <b>{key === "strong" ? "相対強度 +1.5pt以上" : "相対強度 −1.5pt以下"}</b>
                  <p className="mt-2 text-xs">急落日 {s?.eventCount ?? 0}日 ／ 観測 {s?.sampleCount ?? 0}件</p>
                  <p className="mt-2 text-sm">翌日平均：<b>{s?.average1 == null ? "検証中" : percent(s.average1)}</b></p>
                  <p className="text-sm">翌日上昇率：<b>{s?.positiveRate1 == null ? "検証中" : s.positiveRate1 + "%"}</b></p>
                </div>;
              })}
            </div>
          </section>
        </>}
        {report.recent && <section className="space-y-4">
          <div className="rounded-2xl border border-blue-200 bg-white p-4">
            <h2 className="text-xl font-black">📊 直近の相対強弱（通常日も表示）</h2>
            <p className="mt-2 text-sm font-bold">{report.recent.event.date} ／ {report.recent.event.benchmark}
              <span className="ml-2"><PriceChange value={report.recent.event.indexReturn}/></span>
            </p>
            <p className="mt-2 text-xs text-slate-600">比較 {report.recent.examinedStocks}銘柄。
              {report.recent.isLatestSavedDate ? "最新の有効保存日" : "保存データと指数の両方がそろった直近の日"}を使用。
              暴落専用の統計・翌日予測とは区別しています。</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Ranking title="🟢 直近・市場より強かった上位" side="strong" rows={report.recent.strong} context="routine"/>
            <Ranking title="🔴 直近・市場より弱かった下位" side="weak" rows={report.recent.weak} context="routine"/>
          </div>
        </section>}
        {!report.recent && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">直近の市場比ランキングは、参考指数と保存株価が連続する2営業日分そろうまで保留します。</p>}
        <section className="rounded-xl bg-slate-100 p-4 text-xs leading-6 text-slate-600">
          <p>研究版 {report.version} ／ 最終利用可能な保存日 {report.coverage.latestSavedDate ?? "なし"} ／ 当日未確定データは除外</p>
          <p>参考指数は外部の確定日足から読み取り専用で取得し、DBへの保存はしません。この表示は事後の相対比較で、リアルタイム株価・売買可能価格・翌日の上昇予測ではありません。保存欠損日や取得元の価格差、寄り付きのギャップ、約定可否は別途検証が必要です。</p>
          <p>{report.note}</p>
        </section>
      </>}
    </div>
  </main>;
}
