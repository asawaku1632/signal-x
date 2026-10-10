import pool from "@/app/lib/postgres";
import { jstToday } from "@/app/lib/learning/priceReferenceObservations";
import { buildPriceReferenceTrend, type PriceReferenceTrendRow } from "./priceReferenceTrendAnalysis.ts";

const MAX_RESEARCH_ROWS = 5_000;

/** Read-only query, latest observation per date+code, bounded to 90 days. */
export async function getPriceReferenceTrend(now = new Date()) {
  const today = jstToday(now);
  const result = await pool.query<PriceReferenceTrendRow>(
    `WITH latest AS (
       SELECT DISTINCT ON (trade_date, code)
         trade_date::text AS trade_date, code, name,
         baseline_price, reference_price, observation_date_jst::text,
         reference_source,
         EXTRACT(HOUR FROM ((baseline_saved_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Tokyo'))
           AS baseline_saved_hour_jst
       FROM public.daily_learning_price_reference_audits
       WHERE trade_date >= $1::date - INTERVAL '89 days'
         AND trade_date < $1::date
       ORDER BY trade_date DESC, code, observation_date_jst DESC, observed_at DESC, id DESC
     )
     SELECT * FROM latest ORDER BY trade_date DESC, code ASC LIMIT $2`,
    [today, MAX_RESEARCH_ROWS + 1],
  );
  return buildPriceReferenceTrend(result.rows.slice(0, MAX_RESEARCH_ROWS), result.rows.length > MAX_RESEARCH_ROWS);
}
