import pool from "@/app/lib/postgres";
import { getJstDateString } from "@/app/lib/learning/learningSaveStatus";
import { isTseTradingDate, TSE_MARKET_CALENDAR_VERSION } from "@/app/lib/technicalObservation/tseMarketCalendar";

export const WIN_RATE_DAILY_AUDIT_ROUTE = "/api/cron/win-rate-reliability-audit";
export const WIN_RATE_DAILY_AUDIT_KIND = "WIN_RATE_DAILY_AUDIT_V1";

export type ReliabilityWarning =
  | "TODAY_SNAPSHOT_MISSING"
  | "DAILY_LEARNING_UNCONFIRMED"
  | "INVALID_SAVED_PRICE"
  | "PRICE_PROVENANCE_MISMATCH"
  | "RECENT_RESULTS_WITHOUT_PROVENANCE"
  | "PRICE_PROVENANCE_NOT_STARTED";

export type ReliabilityDailySnapshot = {
  kind: typeof WIN_RATE_DAILY_AUDIT_KIND;
  tradeDate: string;
  checkedAt: string;
  calendarVersion: string;
  health: "OK" | "NEEDS_REVIEW";
  warnings: ReliabilityWarning[];
  snapshotCount: number;
  invalidPriceCount: number;
  dailyLearningCompleted: boolean;
  wins: number;
  losses: number;
  holds: number;
  cumulativeWinRate: number | null;
  provenanceCount: number;
  newProvenanceToday: number;
  mismatchedProvenanceCount: number;
  recentJudgedCount: number;
  recentUntracedCount: number;
  provenanceLatestAt: string | null;
};

export function auditDateIsTradingDay(now = new Date()) {
  return isTseTradingDate(getJstDateString(now));
}

export function winRate(wins: number, losses: number): number | null {
  const total = wins + losses;
  return total > 0 ? Math.round((wins / total) * 10_000) / 100 : null;
}

export async function collectWinRateReliabilityAudit(now = new Date()): Promise<ReliabilityDailySnapshot> {
  const tradeDate = getJstDateString(now);
  if (!isTseTradingDate(tradeDate)) {
    throw new Error("NON_TRADING_DAY");
  }

  // Observation only. No external quote requests and no edits to trading results.
  const [snapshot, overall, provenance, recentResults, learning] = await Promise.all([
    pool.query(`
      SELECT COUNT(*)::int AS saved,
             COUNT(*) FILTER (WHERE price IS NULL OR price <= 0)::int AS invalid_price
      FROM daily_stock_results WHERE date = $1
    `, [tradeDate]),
    pool.query(`
      SELECT COUNT(*) FILTER (WHERE result = 'WIN')::int AS wins,
             COUNT(*) FILTER (WHERE result = 'LOSE')::int AS losses,
             COUNT(*) FILTER (WHERE result = 'HOLD')::int AS holds
      FROM daily_stock_results
    `),
    pool.query(`
      SELECT COUNT(*)::int AS traced_count,
             COUNT(*) FILTER (
               WHERE (p.recorded_at AT TIME ZONE 'Asia/Tokyo')::date = $1::date
             )::int AS traced_today,
             COUNT(*) FILTER (
               WHERE result_row.id IS NULL OR source_row.id IS NULL
                  OR p.code IS DISTINCT FROM result_row.code
                  OR p.code IS DISTINCT FROM source_row.code
                  OR p.trade_date IS DISTINCT FROM result_row.date::date
                  OR p.source_trade_date IS DISTINCT FROM source_row.date::date
                  OR p.source_price IS DISTINCT FROM source_row.price
                  OR (p.source_price IS NULL) IS DISTINCT FROM (result_row.next_price IS NULL)
                  OR (p.source_price IS NOT NULL AND result_row.next_price IS NOT NULL
                      AND ABS(p.source_price - result_row.next_price) > 0.000001)
                  OR p.judged_result IS DISTINCT FROM result_row.result
             )::int AS mismatch_count,
             MAX(p.recorded_at) AS latest_recorded_at
      FROM public.daily_result_price_provenance AS p
      LEFT JOIN daily_stock_results AS result_row ON result_row.id = p.daily_result_id
      LEFT JOIN daily_stock_results AS source_row ON source_row.id = p.source_row_id
    `, [tradeDate]),
    pool.query(`
      SELECT COUNT(*)::int AS recent_judged,
             COUNT(*) FILTER (WHERE p.daily_result_id IS NULL)::int AS recent_untraced
      FROM daily_stock_results AS d
      LEFT JOIN public.daily_result_price_provenance AS p ON p.daily_result_id = d.id
      WHERE d.result IN ('WIN', 'LOSE', 'HOLD')
        AND d.checked_at >= NOW() - INTERVAL '36 hours'
    `),
    pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM cron_learning_logs
        WHERE status = 'SUCCESS'
          AND (created_at AT TIME ZONE 'Asia/Tokyo')::date = $1::date
      ) AS completed
    `, [tradeDate]),
  ]);

  const int = (value: unknown) => Number(value ?? 0);
  const s = snapshot.rows[0] ?? {};
  const o = overall.rows[0] ?? {};
  const p = provenance.rows[0] ?? {};
  const r = recentResults.rows[0] ?? {};
  const dailyLearningCompleted = learning.rows[0]?.completed === true;
  const snapshotCount = int(s.saved);
  const invalidPriceCount = int(s.invalid_price);
  const provenanceCount = int(p.traced_count);
  const mismatchedProvenanceCount = int(p.mismatch_count);
  const recentUntracedCount = int(r.recent_untraced);
  const warnings: ReliabilityWarning[] = [];
  if (!snapshotCount) warnings.push("TODAY_SNAPSHOT_MISSING");
  if (!dailyLearningCompleted) warnings.push("DAILY_LEARNING_UNCONFIRMED");
  if (invalidPriceCount) warnings.push("INVALID_SAVED_PRICE");
  if (mismatchedProvenanceCount) warnings.push("PRICE_PROVENANCE_MISMATCH");
  if (recentUntracedCount) warnings.push("RECENT_RESULTS_WITHOUT_PROVENANCE");
  // No price provenance may mean no new judgments, not necessarily an error.
  if (!provenanceCount) warnings.push("PRICE_PROVENANCE_NOT_STARTED");
  const wins = int(o.wins);
  const losses = int(o.losses);

  return {
    kind: WIN_RATE_DAILY_AUDIT_KIND,
    tradeDate,
    checkedAt: now.toISOString(),
    calendarVersion: TSE_MARKET_CALENDAR_VERSION,
    health: warnings.length ? "NEEDS_REVIEW" : "OK",
    warnings,
    snapshotCount,
    invalidPriceCount,
    dailyLearningCompleted,
    wins,
    losses,
    holds: int(o.holds),
    cumulativeWinRate: winRate(wins, losses),
    provenanceCount,
    newProvenanceToday: int(p.traced_today),
    mismatchedProvenanceCount,
    recentJudgedCount: int(r.recent_judged),
    recentUntracedCount,
    provenanceLatestAt: p.latest_recorded_at ? new Date(p.latest_recorded_at).toISOString() : null,
  };
}
