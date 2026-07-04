import { NextResponse } from "next/server";
import pool from "@/app/lib/postgres";

export async function GET() {
  try {
    const { rows } = await pool.query(`
      SELECT
        id,
        pattern_key,
        current_bonus,
        recommended_bonus,
        reason,
        sample_count,
        win_rate,
        evaluation,
        applied,
        created_at
      FROM ai_power_recommendations
      WHERE
        pattern_key LIKE 'RSI:%'
        OR pattern_key LIKE 'MACD:%'
        OR pattern_key LIKE 'TREND:%'
      ORDER BY created_at DESC
      LIMIT 12
    `);

    return NextResponse.json({
      success: true,
      count: rows.length,
      recommendations: rows,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status: 500,
      }
    );
  }
}