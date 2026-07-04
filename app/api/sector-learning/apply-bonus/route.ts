import { NextResponse } from "next/server";
import pool from "@/app/lib/postgres";

export async function GET() {
  const startedAt = Date.now();

  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT ON (sector_key)
        sector_key,
        sector_name,
        win_rate,
        ai_bonus,
        confidence,
        judged_count
      FROM sector_learning_logs
      WHERE judged_count >= 0
      ORDER BY sector_key, trade_date DESC
    `);

    let applied = 0;

    for (const row of rows) {
      await pool.query(
        `
        INSERT INTO ai_power_weight_rules (
          rule_type,
          rule_key,
          bonus,
          win_rate,
          sample_count,
          win_count,
          lose_count,
          confidence,
          is_active,
          updated_at
        )
        VALUES (
          'SECTOR',
          $1,
          $2,
          $3,
          $4,
          0,
          0,
          $5,
          true,
          NOW()
        )
        ON CONFLICT (rule_type, rule_key)
        DO UPDATE SET
          bonus = EXCLUDED.bonus,
          win_rate = EXCLUDED.win_rate,
          sample_count = EXCLUDED.sample_count,
          confidence = EXCLUDED.confidence,
          is_active = true,
          updated_at = NOW()
        `,
        [
          row.sector_key,
          Number(row.ai_bonus ?? 0),
          Number(row.win_rate ?? 0),
          Number(row.judged_count ?? 0),
          Number(row.confidence ?? 0),
        ]
      );

      applied++;
    }

    return NextResponse.json({
      success: true,
      aiPowerVersion: "V13.3_SECTOR_APPLY_BONUS",
      checked: rows.length,
      applied,
      rulesUpdated: applied,
      apiTimeMs: Date.now() - startedAt,
    });
  } catch (error) {
    console.error("sector apply bonus error:", error);

    return NextResponse.json(
      {
        success: false,
        aiPowerVersion: "V13.3_SECTOR_APPLY_BONUS",
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}