import Link from "next/link";
import { notFound } from "next/navigation";
import pool from "@/app/lib/postgres";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import { jstToday } from "@/app/lib/learning/priceReferenceObservations";
import { analyzeCrashStrength } from "@/app/lib/research/crashStrengthShadow.mjs";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

type Stock = {
  code: string; name: string; price: number; cost100: number;
  dailyReturn: number; excessReturn: number;
  after1: number | null; after3: number | null; after5: number | null;
  historical1: { sampleCount: number; average1: number | null; positiveRate1: number | null };
};
type GroupStats = { eventCount: number; sampleCount: number; average1: number | null; positiveRate1: number | null };
type Report = {
  version: string; asOf: string; eventCount: number; examinedStocks?: number;
  coverage: { validSavedDays: number; minimumStocksPerDay: number; latestSavedDate: string | null; source: string };
  event: { date: string; previousDate: string; benchmark: string; indexReturn: number;
    nikkeiReturn: number | null; topixReturn: number | null } | null;
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
function Ranking({title, side, rows}: {title:string;side:"strong"|"weak";rows:Stock[]}) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <h2 className="text-xl font-black">{title}</h2>
    <p className="mt-1 text-xs text-slate-500">急落当日の市場平均との差で並び替え。未来の値上がり・値下がり順ではありません。</p>
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
      <p className="mt-2 text-xs text-slate-500">過去の同銘柄・同分類 {r.historical1.sampleCount}件：
        {r.historical1.average1 === null ? "検証件数不足（5件未満）" :
        `翌日平均 ${percent(r.historical1.average1)} ／ 上昇率 ${r.historical1.positiveRate1}%`}
      </p>
    </article>)}</div>}
    <p className="mt-3 text-xs text-slate-500">{side === "strong" ? "相対強度 +0.5ポイント以上を上位20件表示" : "相対強度 −0.5ポイント以下を下位20件表示"}</p>
  </section>;
}

async function getReport(): Promise<Report> {
  const today = jstToday();
  const since = new Date(Date.parse(today + "T00:00:00Z") - 145 * 86400000).toISOString().slice(0, 10);
  // Reads only. Never writes or requests an external provider.
  const [market, stock] = await Promise.all([
    pool.query(`SELECT trade_date::text AS date, nikkei, topix
      FROM public.market_learning_logs
      WHERE trade_date >= $1::date AND trade_date < $2::date
      ORDER BY trade_date DESC`, [since, today]),
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
  return analyzeCrashStrength({marketRows:market.rows,priceRows:stock.rows,asOf:today}) as Report;
}

export default async function CrashStrengthShadowPage() {
  const { isOwner } = await getLearningOwnerSession();
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
        <p className="mt-2 text-sm text-slate-600">保存済みの日経平均・TOPIXと約1,000銘柄の日次参考価格を照合。
        暴落当日に市場より強かった株・弱かった株と、その後の1・3・5保存日を研究します。</p>
        <p className="mt-2 text-xs font-bold text-amber-700">🔒 本人専用・読み取り専用・既存AI判定/LINE通知/注文は変更しません</p>
      </header>
      {!report ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">研究用データを取得できませんでした。既存データは変更していません。</p> : <>
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-black">市場の暴落判定</h2>
          {report.event ? <>
            <p className="mt-2 text-2xl font-black text-red-700">{report.event.date} ｜ {report.event.benchmark} {percent(report.event.indexReturn)}</p>
            <p className="mt-2 text-sm">日経平均 <PriceChange value={report.event.nikkeiReturn}/> ／ TOPIX <PriceChange value={report.event.topixReturn}/></p>
            <p className="mt-2 text-sm text-slate-600">条件：日経平均またはTOPIXが前保存日比−2％以下。
              {report.coverage.latestSavedDate !== report.event.date ? " 最新の保存日とは異なる過去の急落記録です。" : " 直近の有効保存日に該当しています。"}</p>
            <p className="mt-2 text-xs text-slate-500">判定対象 {report.examinedStocks}銘柄 ／ 有効保存日 {report.coverage.validSavedDays}日 ／ 急落記録 {report.eventCount}日</p>
          </> : <p className="mt-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">直近の保存データには、日経平均/TOPIXが−2％以下で、銘柄価格が800件以上そろった急落日がありません。未検出は安全の保証ではありません。</p>}
        </section>
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
        <section className="rounded-xl bg-slate-100 p-4 text-xs leading-6 text-slate-600">
          <p>研究版 {report.version} ／ 最終利用可能な保存日 {report.coverage.latestSavedDate ?? "なし"} ／ 当日未確定データは除外</p>
          <p>この表示は事後保存された参考価格による相対比較で、リアルタイム株価・売買可能価格・翌日の上昇予測ではありません。保存欠損日や取得元の価格差、寄り付きのギャップ、約定可否は別途検証が必要です。</p>
          <p>{report.note}</p>
        </section>
      </>}
    </div>
  </main>;
}
