import { NextResponse } from "next/server";
import pool from "@/app/lib/postgres";

export async function GET() {
  try {
    const { rows } = await pool.query(`
      SELECT
        id,
        rule_type,
        rule_key,
        old_bonus,
        new_bonus,
        win_rate,
        sample_count,
        reason,
        applied_at
      FROM ai_power_evolution_logs
      ORDER BY applied_at DESC
      LIMIT 30
    `);

    return NextResponse.json({
      success: true,
      count: rows.length,
      history: rows,
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