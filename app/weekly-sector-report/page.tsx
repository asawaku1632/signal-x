import Link from "next/link";
import BottomNav from "@/app/components/BottomNav";
import pool from "@/app/lib/postgres";
import {
  percent, rank, recognizedCodes, weeksForNow,
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
type OutcomeItem = {
  sectorKey: string;
  sectorName: string;
  rank: number;
  forecastScore: number;
  status: "COMPLETE" | "INCOMPLETE";
  averageReturnPercent: number | null;
  hit: boolean | null;
  expected: number;
  matched: number;
  missingCodes: string[];
};
type OutcomeAudit = {
  target_week_start: string;
  baseline_date: string;
  end_date: string;
  status: "COMPLETE" | "INCOMPLETE";
  items: OutcomeItem[];
  evaluated_at: string;
};

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
  const grades = new Map<string, OutcomeAudit>();
  if (!error && archived.length) {
    try {
      const { rows } = await pool.query<OutcomeAudit>(`
        SELECT target_week_start::text, baseline_date::text, end_date::text,
               status, items, evaluated_at::text
        FROM weekly_sector_outcome_audits
        WHERE target_week_start = ANY($1::date[])
      `, [archived.map((snapshot) => snapshot.target_week_start)]);
      rows.forEach((audit) => grades.set(audit.target_week_start, audit));
    } catch (cause) {
      console.error("weekly sector verified results unavailable:", cause);
    }
  }
  const fullyGraded = archived.flatMap((forecast) =>
    grades.get(forecast.target_week_start)?.items.filter((item) => item.status === "COMPLETE") ?? [],
  );
  const winning = fullyGraded.filter((item) => item.hit === true).length;
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
            発行時に構成銘柄とTOP3を固定。予測前の最終取引日と翌週末のYahoo日足終値を比較し、各銘柄の週間騰落率を均等平均して採点します。
          </p>
          {fullyGraded.length > 0 && (
            <div className="mt-2 rounded-xl border border-blue-200 bg-blue-50 p-3">
              <p className="text-xs font-black text-blue-700">✅ 完了した予測のプラス判定率</p>
              <p className="mt-1 text-xl font-black text-slate-900">{winning}/{fullyGraded.length}件
                <span className="ml-2 text-sm">({Math.round(100 * winning / fullyGraded.length)}%)</span>
              </p>
              <p className="mt-1 text-[10px] text-slate-500">代表銘柄の均等平均がプラスなら的中。市場の33業種指数の上昇率ではありません。</p>
            </div>
          )}
          {archived.length === 0 ? (
            <p className="mt-2 rounded-xl border bg-white p-3 text-xs text-slate-600">
              まだ過去の発行履歴はありません。翌週の取引終了後、保存済み終値で自動採点します。
            </p>
          ) : (
            <div className="mt-2 space-y-2">
              {archived.map((snapshot) => {
                const audit = grades.get(snapshot.target_week_start);
                const evaluation = snapshot.items.map((sector) => ({
                  sector, verified: audit?.items.find((item) => item.sectorKey === sector.key),
                }));
                const measured = evaluation.filter((x) => x.verified?.status === "COMPLETE");
                const positives = measured.filter((x) => x.verified?.hit === true).length;
                return (
                  <article key={snapshot.target_week_start} className="rounded-xl border bg-white p-3 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-black">{snapshot.target_week_start} 週の予測</h3>
                      <span className="text-[10px] font-black text-slate-500">
                        {audit ? `検証済み ${measured.length}/${snapshot.items.length}件・プラス ${positives}件` : "終値検証待ち"}
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] text-slate-500">
                      予測に使用：{snapshot.as_of_date ?? "不明"}まで
                      {audit && <> ／ 終値比較：{audit.baseline_date} → {audit.end_date}</>}
                    </p>
                    <div className="mt-2 space-y-1.5">
                      {evaluation.map(({ sector, verified }, i) => {
                        const available = verified?.status === "COMPLETE" && verified.averageReturnPercent !== null;
                        return (
                          <div key={sector.key} className="flex items-center justify-between gap-2 border-t border-slate-100 pt-1.5">
                            <div className="min-w-0">
                              <p className="text-xs font-black">{medals[i]} {sector.name}</p>
                              <p className="text-[10px] text-slate-500">発行スコア {sector.score} ／ 構成 {verified?.expected ?? sector.codeCount}銘柄</p>
                            </div>
                            <div className="text-right">
                              <p className={`text-xs font-black ${available ? verified!.hit ? "text-emerald-600" : "text-blue-600" : "text-slate-500"}`}>
                                {available ? `${verified!.hit ? "✅ プラス" : "✖ プラスならず"} ${percent(verified!.averageReturnPercent!)}` : "⏳ 検証待ち"}
                              </p>
                              {verified && !available && (
                                <p className="text-[10px] text-slate-500">価格照合 {verified.matched}/{verified.expected}件</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-[10px] text-slate-500">
                      Yahoo日足終値を別記録で比較。資料不足のセクターは採点せず、翌週の業種指数を代表する数字とは限りません。
                    </p>
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
            保存価格の監査も継続中です。株式分割などがある週は日足データを別途確認する必要があります。銘柄の終値が揃わない場合は採点保留とします。
            相対スコアだけを根拠に売買しないでください。
          </p>
        </section>
        <p className="mt-2 text-[10px] leading-4 text-slate-500">
          分類対象は代表銘柄{recognizedCodes.length}コード、今週集計条件を満たす{eligible}セクター。
          予測は週単位で一度だけ保存し、後日Yahooの終値で独立検証。元データ・売買判定・通知を変更しません。
        </p>
      </div>
      <BottomNav />
    </main>
  );
}
