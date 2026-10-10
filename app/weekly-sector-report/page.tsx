import Link from "next/link";
import BottomNav from "@/app/components/BottomNav";
import pool from "@/app/lib/postgres";
import {
  aggregate, percent, rank, recognizedCodes, weeksForNow,
  type RankedSector, type ResultRow,
} from "@/app/lib/weeklySectorReport";

export const dynamic = "force-dynamic";

type ForecastSnapshot = {
  target_week_start: string;
  target_week_end: string;
  source_week_start: string;
  source_week_end: string;
  as_of_date: string | null;
  created_at: string;
  items: RankedSector[];
  eligible_sector_count: number;
};
type Observed = { average: number; count: number; days: number } | null;

function compareOutcomes(rows: ResultRow[], sectorKey: string): Observed {
  const found = aggregate(rows).get(sectorKey);
  if (!found || found.priced < 10 || found.dates.size < 2) return null;
  return {
    average: found.sumChange / found.priced,
    count: found.priced,
    days: found.dates.size,
  };
}

export default async function WeeklySectorReportPage() {
  const weeks = weeksForNow();
  let snapshots: ForecastSnapshot[] = [];
  let current: ForecastSnapshot | undefined;
  let candidates: RankedSector[] = [];
  let isPreview = false;
  let newestData: string | null = null;
  let eligible = 0;
  let error = false;
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());

  try {
    const history = await pool.query<ForecastSnapshot>(`
      SELECT target_week_start::text, target_week_end::text,
        source_week_start::text, source_week_end::text,
        as_of_date::text, created_at::text, items, eligible_sector_count
      FROM weekly_sector_forecasts
      ORDER BY target_week_start DESC LIMIT 12
    `);
    snapshots = history.rows;
    current = snapshots.find((snapshot) => snapshot.target_week_start === weeks.targetStart);
    if (current) {
      candidates = current.items;
      newestData = current.as_of_date;
      eligible = Number(current.eligible_sector_count);
    } else {
      // Preview is intentionally not persisted and is never presented as a past forecast.
      const { rows } = await pool.query<ResultRow>(`
        SELECT date, code, name, result, change_percent
        FROM daily_stock_results
        WHERE date >= $1 AND date < $2
          AND code = ANY($3::text[])
          AND result IN ('WIN','LOSE','HOLD')
          AND change_percent IS NOT NULL
        ORDER BY date, code
      `, [weeks.previousStart, weeks.targetStart, recognizedCodes]);
      const sourceRows = rows.filter((row) => row.date >= weeks.sourceStart);
      newestData = sourceRows.length ? sourceRows[sourceRows.length - 1].date : null;
      ({ ranked: candidates, eligible } = rank(rows, weeks.sourceStart));
      isPreview = true;
    }
  } catch (cause) {
    console.error("weekly sector view failed:", cause);
    error = true;
  }

  const archived = snapshots.filter((snapshot) => snapshot.target_week_start !== weeks.targetStart).slice(0, 8);
  let realized: ResultRow[] = [];
  if (!error && archived.length) {
    try {
      const start = [...archived].sort((a, b) => a.target_week_start.localeCompare(b.target_week_start))[0].target_week_start;
      const end = [...archived].sort((a, b) => b.target_week_end.localeCompare(a.target_week_end))[0].target_week_end;
      const { rows } = await pool.query<ResultRow>(`
        SELECT date, code, name, result, change_percent
        FROM daily_stock_results
        WHERE date >= $1 AND date <= $2
          AND code = ANY($3::text[])
          AND result IN ('WIN','LOSE','HOLD')
          AND change_percent IS NOT NULL
        ORDER BY date, code
      `, [start, end, recognizedCodes]);
      realized = rows;
    } catch (cause) {
      console.error("weekly sector evaluation read failed:", cause);
    }
  }
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <main className="min-h-screen bg-[#f7f9fc] pb-28 text-slate-900">
      <div className="mx-auto max-w-md px-3 pt-3 lg:max-w-3xl lg:px-6">
        <header className="flex items-center gap-3">
          <Link href="/dashboard" className="grid h-9 w-9 place-items-center rounded-full bg-white shadow" aria-label="ホームに戻る">‹</Link>
          <div>
            <p className="text-[10px] font-black tracking-[.16em] text-blue-600">SIGNALX WEEKLY SECTOR</p>
            <h1 className="text-xl font-black">🔮 来週の注目セクター TOP3</h1>
          </div>
        </header>
        <section className="mt-3 rounded-2xl bg-gradient-to-r from-slate-900 to-blue-800 p-4 text-white">
          <p className="text-[10px] font-black text-blue-200">
            {current ? "📌 発行済み・予測順位を固定保存" : "🧪 未発行・参考プレビュー"}
          </p>
          <p className="mt-2 text-xl font-black">{weeks.targetStart} 〜 {weeks.targetEnd}</p>
          <p className="mt-1 text-xs font-bold text-blue-100">参照期間：{weeks.sourceStart} 〜 {weeks.sourceEnd}</p>
          <p className="mt-1 text-xs font-bold text-blue-100">参照できた最終判定日：{newestData ?? "なし"}</p>
          <p className="mt-2 text-[11px] leading-5 text-blue-100">
            毎週土曜9時に発行・保存し、日曜20時に保存漏れを再確認します。
            将来の値動きではなく、それ以前に確定した代表銘柄の成績から候補を選びます。
          </p>
        </section>

        {error ? (
          <section className="mt-3 rounded-xl border bg-white p-4 text-sm font-bold text-rose-700">
            レポートを取得できませんでした。データベースの導入状況を確認してください。
          </section>
        ) : candidates.length === 0 ? (
          <section className="mt-3 rounded-xl border bg-white p-4">
            <h2 className="font-black">今週の候補はまだありません</h2>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              判定済みデータの不足により順位を作成できません。2取引日以上・10件以上の価格結果が必要です。
            </p>
          </section>
        ) : (
          <section className="mt-3 space-y-2" aria-label="来週の注目セクター候補">
            {isPreview && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-black text-amber-800">
              この順位は保存前の参考表示です。正式な予測履歴・的中率には含めません。
            </p>}
            {candidates.map((sector, index) => (
              <article key={sector.key} className="rounded-2xl border border-blue-100 bg-white p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-bold text-slate-500">参考候補 {index + 1}位</p>
                    <h2 className="mt-0.5 text-lg font-black">{medals[index]} {sector.name}</h2>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-500">相対スコア</p>
                    <p className="text-2xl font-black text-blue-700">{sector.score}<span className="text-xs"> / 100</span></p>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="text-[10px] text-slate-500">前週の平均変化</p>
                    <p className="mt-1 text-sm font-black">{percent(sector.avgChange)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="text-[10px] text-slate-500">その前の週との差</p>
                    <p className="mt-1 text-sm font-black">{sector.previousAvg === null ? "比較なし" : `${(sector.avgChange - sector.previousAvg).toFixed(2)}pt`}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="text-[10px] text-slate-500">判定済み</p>
                    <p className="mt-1 text-sm font-black">{sector.total.toLocaleString("ja-JP")}件</p>
                  </div>
                </div>
                <p className="mt-2 text-[11px] leading-5 text-slate-600">
                  対象{sector.codeCount}銘柄・{sector.tradeDays}取引日、WIN {sector.wins}／LOSE {sector.losses}／HOLD {sector.holds}
                </p>
                {sector.examples.length > 0 && (
                  <div className="mt-2 border-t border-slate-100 pt-2">
                    <p className="mb-1 text-[10px] font-bold text-slate-500">参考銘柄（過去実績順、買い推奨ではありません）</p>
                    <div className="flex flex-wrap gap-1.5">
                      {sector.examples.map((stock) => (
                        <Link href={`/analysis/${stock.code}`} key={stock.code} className="rounded-lg bg-blue-50 px-2 py-1.5 text-[11px] font-black text-blue-700">
                          {stock.code} {stock.name} ›
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            ))}
          </section>
        )}

        <section className="mt-5">
          <h2 className="text-lg font-black">📝 過去予測の答え合わせ</h2>
          <p className="mt-1 text-[11px] leading-5 text-slate-600">
            発行時のTOP3は固定。発行後の対象週に確定した銘柄別・翌営業日価格変化の平均と比較します。
          </p>
          {archived.length === 0 ? (
            <p className="mt-2 rounded-xl border bg-white p-3 text-xs text-slate-600">
              まだ過去の発行履歴はありません。週次の保存が始まると自動で蓄積します。
            </p>
          ) : (
            <div className="mt-2 space-y-2">
              {archived.map((snapshot) => {
                const observedRows = realized.filter((row) => row.date >= snapshot.target_week_start && row.date <= snapshot.target_week_end);
                const finishedWeek = snapshot.target_week_end < today;
                const evaluations = snapshot.items.map((sector) => ({
                  sector, observed: compareOutcomes(observedRows, sector.key),
                }));
                const measured = evaluations.filter((x) => x.observed !== null);
                const positives = measured.filter((x) => (x.observed?.average ?? 0) > 0).length;
                return (
                  <article key={snapshot.target_week_start} className="rounded-xl border bg-white p-3 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-black">{snapshot.target_week_start} 週の予測</h3>
                      <span className="text-[10px] font-black text-slate-500">
                        {finishedWeek ? `評価可能 ${measured.length}/${snapshot.items.length}件・プラス ${positives}件` : "対象週の途中／未開始"}
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] text-slate-500">発行時に使用したデータ：{snapshot.as_of_date ?? "不明"}まで</p>
                    <div className="mt-2 space-y-1.5">
                      {evaluations.map(({ sector, observed }, i) => (
                        <div key={sector.key} className="flex items-center justify-between gap-2 border-t border-slate-100 pt-1.5">
                          <span className="text-xs font-black">{medals[i]} {sector.name} <span className="text-[10px] font-normal text-slate-500">予測スコア{sector.score}</span></span>
                          <span className={`text-xs font-black ${observed ? observed.average > 0 ? "text-emerald-600" : "text-blue-600" : "text-slate-500"}`}>
                            {observed ? `${percent(observed.average)}（${observed.count}件）` : "判定待ち"}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-[10px] text-slate-500">結果は判定済み銘柄のみの参考集計。業種指数の週間騰落率ではありません。</p>
                  </article>
                );
              })}
            </div>
          )}
        </section>
        <section className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <h2 className="text-xs font-black text-amber-900">⚠️ 検証版の制約</h2>
          <p className="mt-1 text-[11px] leading-5 text-amber-950">
            代表銘柄のみの分類で、全上場銘柄・実際の資金流入・来週の上昇確率を表していません。
            保存価格の監査も継続中です。週の途中や未判定銘柄がある場合、実績は後日変わります。
            相対スコアだけを根拠に売買しないでください。
          </p>
        </section>
        <p className="mt-2 text-[10px] leading-4 text-slate-500">
          分類対象は代表銘柄{recognizedCodes.length}コード、今週集計条件を満たす{eligible}セクター。
          予測は週単位で一度だけ保存し、元データ・売買判定・通知を変更しません。
        </p>
      </div>
      <BottomNav />
    </main>
  );
}
