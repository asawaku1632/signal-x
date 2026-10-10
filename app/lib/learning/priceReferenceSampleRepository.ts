import pool from "@/app/lib/postgres";
import { isValidPriceAuditDate } from "@/app/lib/learning/dailyPriceAudit";
import { jstToday } from "@/app/lib/learning/priceReferenceObservations";
import { isTseTradingDate } from "@/app/lib/technicalObservation/tseMarketCalendar";
import {
  chooseReferenceSample, MAX_SAMPLE_UNIVERSE, REFERENCE_SAMPLE_ALGORITHM,
  type SampleInput,
} from "@/app/lib/learning/priceReferenceSampler";

const MIN_DAILY_COVERAGE = 800;
const MAX_LOOKBACK_DAYS = 90;

// daily_stock_results.date is stored as ISO YYYY-MM-DD TEXT, not SQL DATE.
// Lexical comparison is valid only after we validate/use the canonical ISO date format.
type DateRow = { date: string | null };
type ObservedCode = { code: string };

export async function getSuggestedPriceReferenceBatch(requestedDate: string | null, now = new Date()) {
  const today = jstToday(now);
  let tradeDate = requestedDate;
  if (tradeDate == null || tradeDate === "") {
    const result = await pool.query<DateRow>(
      "SELECT MAX(date) AS date FROM public.daily_stock_results WHERE date < $1",
      [today],
    );
    tradeDate = result.rows[0]?.date ?? null;
  }
  if (!tradeDate || !isValidPriceAuditDate(tradeDate)
      || tradeDate >= today || !isTseTradingDate(tradeDate)) {
    throw new Error("INVALID_TRADE_DATE");
  }
  const start = new Date(today + "T00:00:00Z");
  start.setUTCDate(start.getUTCDate() - MAX_LOOKBACK_DAYS);
  if (tradeDate < start.toISOString().slice(0, 10)) throw new Error("OUTSIDE_RESEARCH_WINDOW");

  const [baseline, observed] = await Promise.all([
    pool.query<SampleInput>(
      "SELECT code, name, price FROM public.daily_stock_results WHERE date = $1 ORDER BY code LIMIT $2",
      [tradeDate, MAX_SAMPLE_UNIVERSE + 1],
    ),
    pool.query<ObservedCode>(
      "SELECT DISTINCT code FROM public.daily_learning_price_reference_audits WHERE trade_date = $1::date",
      [tradeDate],
    ),
  ]);
  // Do not silently sample a tiny or partially failed market scan as representative.
  if (baseline.rows.length < MIN_DAILY_COVERAGE || baseline.rows.length > MAX_SAMPLE_UNIVERSE) {
    throw new Error("INSUFFICIENT_DAILY_COVERAGE");
  }
  const selection = chooseReferenceSample(tradeDate, baseline.rows, new Set(observed.rows.map((r) => r.code)));
  return {
    tradeDate, sourceCount: baseline.rows.length, observedCount: observed.rows.length,
    method: REFERENCE_SAMPLE_ALGORITHM,
    ...selection,
    note: "保存済み株価のみで価格帯を分散した候補。後日の騰落や価格差を参照しません。選定は参考案であり、Yahoo日足の取得は一切行っていません。過去の保存記録は変更しません。",
  };
}

/**
 * Lightweight, read-only picker of recent stored trading dates.
 * Shows already-audited securities to help distribute manual checks across days.
 * No external requests and no new scheduled job.
 */
type StoredDayRow = { date: string; source_count: number; observed_count: number };
export async function getAvailablePriceReferenceDates(now = new Date()) {
  const today = jstToday(now);
  const since = new Date(today + "T00:00:00Z");
  since.setUTCDate(since.getUTCDate() - MAX_LOOKBACK_DAYS);
  const result = await pool.query<StoredDayRow>(
    `WITH completed_days AS (
       SELECT date, COUNT(*)::int AS source_count
         FROM public.daily_stock_results
        WHERE date < $1 AND date >= $2
        GROUP BY date
        HAVING COUNT(*) BETWEEN $3 AND $4
        ORDER BY date DESC
        LIMIT 8
     )
     SELECT d.date, d.source_count, COUNT(DISTINCT r.code)::int AS observed_count
       FROM completed_days d
       LEFT JOIN public.daily_learning_price_reference_audits r
         ON r.trade_date = d.date::date
      GROUP BY d.date, d.source_count
      ORDER BY d.date DESC`,
    [today, since.toISOString().slice(0, 10), MIN_DAILY_COVERAGE, MAX_SAMPLE_UNIVERSE],
  );
  return result.rows.filter((x) => isValidPriceAuditDate(x.date) && isTseTradingDate(x.date));
}
