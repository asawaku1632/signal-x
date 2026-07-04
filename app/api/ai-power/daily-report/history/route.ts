import { NextResponse } from "next/server";
import pool from "@/app/lib/postgres";

export async function GET() {
  try {
    const { rows } = await pool.query(`
      SELECT
        id,
        report_date,
        health_score,
        scan_count,
        acquisition_rate,
        generated_recommendations,
        applied_recommendations,
        evolution_count,
        line_sent,
        line_top_code,
        line_top_name,
        line_ranking_count,
        qa_status,
        qa_error_count,
        summary,
        created_at
      FROM ai_daily_reports
      ORDER BY report_date DESC, created_at DESC
      LIMIT 30
    `);

    return NextResponse.json({
      success: true,
      count: rows.length,
      history: rows.reverse(),
    });
  } catch (error) {
    console.error("daily report history error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}