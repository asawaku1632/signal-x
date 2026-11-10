import { NextResponse } from "next/server";
import pool from "@/app/lib/postgres";
import { requireCronAuth } from "@/app/lib/cronAuth";
import { marketScanGuard } from "@/app/lib/marketScanGuard";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Outcomes are only computed from separately verified, adjusted daily closes.
 * This endpoint does NOT fetch market data and never substitutes another
 * study's retrospective scores or prices for missing historical observations.
 */
export async function GET(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;
  // Fail closed until entry-price adjustment and source provenance are certified.
  if (process.env.OWNER_RANKING_FORWARD_CERTIFIED !== "true") {
    return NextResponse.json({ success: false, status: "adjustment_audit_required",
      note: "Do not compare raw intraday entry prices against adjusted closes." }, { status: 503 });
  }
  const market = marketScanGuard();
  if (!market.calendarKnown || !market.dateJst) {
    return NextResponse.json({ success: false, status: "calendar_unknown" }, { status: 503 });
  }
  try {
    // The 1st/3rd/5th dates are taken from the provider's verified exchange
    // session calendar: at least one independently verified close per session.
    // A session with missing market-wide coverage is not accepted as a day.
    const result = await pool.query(`
      WITH verified_sessions AS (
        SELECT trade_date
        FROM owner_ranking_verified_closes
        WHERE provider = 'JQUANTS_ADJUSTED_DAILY'
          AND provider_published_at <= now()
          AND trade_date < $1::date
          AND adjustment_version = 'ENTRY_COMPATIBLE_V1'
        GROUP BY trade_date
        HAVING count(DISTINCT code) >= 800
      ), eligible AS (
        SELECT c.id AS capture_id, c.trade_date_jst, c.slot_jst,
          item->>'code' AS code, (item->>'price')::numeric AS entry_price,
          row_number() OVER (PARTITION BY c.id, item->>'code' ORDER BY (item->>'rank')::integer) AS duplicate_rank
        FROM owner_ranking_forward_captures c
        CROSS JOIN LATERAL jsonb_array_elements(c.records) item
        WHERE c.slot_jst <> '08:50'
          AND item->>'eligibleForForward' = 'true'
          AND item->>'quoteTimeVerified' = 'true'
          AND item->>'price' ~ '^[0-9]+(\\.[0-9]+)?$'
          AND (item->>'price')::numeric > 0
      ), target_days AS (
        SELECT e.*, v.trade_date AS outcome_date,
          row_number() OVER (PARTITION BY e.capture_id, e.code ORDER BY v.trade_date) AS horizon
        FROM eligible e
        JOIN verified_sessions v ON v.trade_date > e.trade_date_jst
        WHERE e.duplicate_rank = 1
      )
      INSERT INTO owner_ranking_forward_outcomes
        (capture_id, code, horizon, outcome_date, entry_price,
         exit_adjusted_close, return_pct, price_provider, adjustment_version)
      SELECT t.capture_id, t.code, t.horizon, t.outcome_date, t.entry_price,
        p.adjusted_close,
        round((p.adjusted_close / t.entry_price - 1) * 100, 6),
        p.provider, p.adjustment_version
      FROM target_days t
      JOIN owner_ranking_verified_closes p
        ON p.trade_date = t.outcome_date AND p.code = t.code
        AND p.provider = 'JQUANTS_ADJUSTED_DAILY'
        AND p.provider_published_at <= now()
      WHERE t.horizon IN (1,3,5)
        AND t.outcome_date < $1::date
        AND p.adjustment_version = 'ENTRY_COMPATIBLE_V1'
      ON CONFLICT (capture_id, code, horizon) DO NOTHING
      RETURNING capture_id, code, horizon
    `, [market.dateJst]);
    return NextResponse.json({ success: true, inserted: result.rowCount,
      status: "verified_outcomes_only",
      note: "No result without verified daily close and complete trading-session coverage." });
  } catch (error) {
    console.error("ranking forward outcome calculation failed", error);
    return NextResponse.json({ success: false, status: "storage_or_validation_error" }, { status: 500 });
  }
}
