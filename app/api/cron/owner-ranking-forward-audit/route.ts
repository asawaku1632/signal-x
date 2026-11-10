import { NextResponse } from "next/server";
import pool from "@/app/lib/postgres";
import { requireCronAuth } from "@/app/lib/cronAuth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Read-only audit of the forward pipeline.
 * A ranking observation never becomes a verified result merely because
 * enough trading days have passed.
 */
export async function GET(request: Request) {
  const unauthorized = requireCronAuth(request);
  if (unauthorized) return unauthorized;
  try {
    const [captures, staged, certified, outcomes] = await Promise.all([
      pool.query(`SELECT slot_jst, count(*)::integer AS captures,
        sum(jsonb_array_length(records))::integer AS observed_rows,
        sum(eligible_count)::integer AS eligible_rows
        FROM owner_ranking_forward_captures GROUP BY slot_jst ORDER BY slot_jst`),
      pool.query(`SELECT count(DISTINCT trade_date)::integer AS staged_dates,
        count(*)::integer AS staged_rows FROM owner_ranking_jquants_daily_staging`),
      pool.query(`SELECT count(*)::integer AS verified_entry_rows,
        count(*) FILTER (WHERE corporate_actions_verified AND quote_provenance_verified)::integer AS certified_entries
        FROM owner_ranking_verified_entry_basis`),
      pool.query(`SELECT horizon, count(*)::integer AS results,
        round(avg(return_pct), 4) AS average_return_pct,
        round(100 * avg(CASE WHEN return_pct > 0 THEN 1.0 ELSE 0.0 END), 2) AS positive_pct
        FROM owner_ranking_forward_outcomes GROUP BY horizon ORDER BY horizon`),
    ]);
    return NextResponse.json({
      success: true,
      certifiedModeEnabled: process.env.OWNER_RANKING_FORWARD_CERTIFIED === "true",
      captures: captures.rows, stagedDaily: staged.rows[0] ?? null,
      entryCertification: certified.rows[0] ?? null,
      outcomes: outcomes.rows,
      caveat: "Only certified entries and provider-confirmed closes may count as results. Missing rows are not losses or wins.",
    });
  } catch (error) {
    console.error("owner ranking forward audit failed", error);
    return NextResponse.json({ success: false, status: "audit_unavailable_or_schema_not_applied" }, { status: 503 });
  }
}
