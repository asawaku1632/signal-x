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
    const [summary, candidates] = await Promise.all([
      pool.query(`SELECT profile_key, confirmation_key, signal_version,
        sample_count, completed_5d_count, avg_return_5d, median_return_5d,
        positive_rate_5d, distinct_codes, distinct_dates,
        benchmarked_5d_count, avg_excess_return_5d, median_excess_return_5d, excess_positive_rate_5d,
        distinct_months, distinct_market_patterns,
        validation_status, status_reason, updated_at
        FROM momentum_memory_forward_stats
        ORDER BY profile_key, confirmation_key`),
      pool.query(`SELECT m.trade_date,m.code,
        COALESCE(d.name,p.name,m.code) AS name,
        m.profile_key,m.confirmation_key,m.current_ai_power,
        m.prev3_avg_ai_power,m.prev3_max_ai_power,m.ai_power_drop_from_peak,
        m.result_1d,m.result_3d,m.result_5d,m.benchmark_key,m.benchmark_5d,m.excess_return_5d,m.signal_version,m.updated_at
        FROM momentum_memory_observations m
        LEFT JOIN LATERAL (
          SELECT name FROM daily_stock_results d
          WHERE d.code=m.code AND d.date::date=m.trade_date
          ORDER BY d.created_at DESC LIMIT 1
        ) d ON true
        LEFT JOIN LATERAL (
          SELECT name FROM pattern_learning_logs p
          WHERE p.code=m.code AND p.trade_date=m.trade_date
          ORDER BY p.created_at DESC LIMIT 1
        ) p ON true
        WHERE m.validation_mode='FORWARD'
          AND m.observation_flag=true
          AND m.confirmation_key='MACD_GC'
        ORDER BY m.trade_date DESC,m.research_score DESC,m.code
        LIMIT 100`)
    ]);
    return NextResponse.json({
      success:true,
      stats:summary.rows,
      candidates:candidates.rows
    }, { headers: { "Cache-Control":"no-store" } });
  } catch (error) {
    console.error("Momentum Memory admin API error:", error);
    return NextResponse.json({ success:false,error:"Momentum Memory data is unavailable" }, { status:500 });
  }
}
