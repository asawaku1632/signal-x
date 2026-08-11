import { NextResponse } from "next/server";
import { getAdminSession } from "@/app/lib/admin";
import pool from "@/app/lib/postgres";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  if (!(await getAdminSession()).isAdmin) {
    return NextResponse.json({ success: false, error: "Administrator access required" }, { status: 403 });
  }
  try {
    const [summary, bonuses, horizons, performance] = await Promise.all([
      pool.query(`SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE signal_date = (NOW() AT TIME ZONE 'Asia/Tokyo')::date)::int AS today,
        COUNT(*) FILTER (WHERE side = 'LOWER_REBOUND')::int AS lower,
        COUNT(*) FILTER (WHERE side = 'UPPER_OVERHEAT')::int AS upper
        FROM bb_signal_events`),
      pool.query(`SELECT bb_bonus, COUNT(*)::int AS count
        FROM bb_signal_events GROUP BY bb_bonus ORDER BY bb_bonus DESC`),
      pool.query(`SELECT horizon, COUNT(*)::int AS count
        FROM bb_signal_event_results GROUP BY horizon ORDER BY horizon`),
      pool.query(`SELECT e.bb_bonus, r.horizon,
          COUNT(*)::int AS count,
          AVG(r.return_percent)::float AS average_return,
          AVG(CASE
            WHEN e.side = 'LOWER_REBOUND' AND r.return_percent > 0 THEN 1
            WHEN e.side = 'UPPER_OVERHEAT' AND e.upper_regime = 'UPPER_REVERSAL'
                 AND r.return_percent < 0 THEN 1
            ELSE 0 END)::float * 100 AS directional_rate
        FROM bb_signal_events e
        JOIN bb_signal_event_results r ON r.event_id = e.id
        GROUP BY e.bb_bonus, r.horizon
        ORDER BY e.bb_bonus DESC, r.horizon`),
    ]);
    return NextResponse.json({
      success: true,
      summary: summary.rows[0],
      bonusCounts: bonuses.rows,
      evaluatedCounts: horizons.rows,
      performance: performance.rows,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("BB observation admin API error:", error);
    return NextResponse.json({ success: false, error: "BB observation data is unavailable" }, { status: 500 });
  }
}
