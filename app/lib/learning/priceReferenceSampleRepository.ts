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
