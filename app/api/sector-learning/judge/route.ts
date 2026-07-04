import { NextResponse } from "next/server";
import pool from "@/app/lib/postgres";

function calculateBonus(winRate: number, judged: number) {
  if (judged < 10) return 0;

  if (winRate >= 90) return 8;
  if (winRate >= 80) return 5;
  if (winRate >= 70) return 3;
  if (winRate >= 60) return 1;
  if (winRate >= 45) return 0;
  if (winRate >= 35) return -2;
  if (winRate >= 25) return -5;

  return -8;
}

function calculateConfidence(judged: number) {
  if (judged >= 300) return 100;
  if (judged >= 100) return 80;
  if (judged >= 30) return 60;
  if (judged >= 10) return 40;

  return 0;
}

export async function GET() {
  const startedAt = Date.now();

  try {
    const { rows } = await pool.query(`
      SELECT
        id,
        sector_key,
        sector_name,
        win_count,
        lose_count,
        hold_count,
        judged_count
      FROM sector_learning_logs
      ORDER BY trade_date DESC
    `);

    let updated = 0;

    for (const row of rows) {
      const win = Number(row.win_count ?? 0);
      const lose = Number(row.lose_count ?? 0);
      const hold = Number(row.hold_count ?? 0);

      const judged =
        Number(row.judged_count ?? 0) ||
        win + lose + hold;

      const winRate =
        judged > 0
          ? Number(((win / judged) * 100).toFixed(2))
          : 0;

      const aiBonus = calculateBonus(
        winRate,
        judged
      );

      const confidence =
        calculateConfidence(judged);

      await pool.query(
        `
        UPDATE sector_learning_logs
        SET
          judged_count=$1,
          win_rate=$2,
          ai_bonus=$3,
          confidence=$4
        WHERE id=$5
        `,
        [
          judged,
          winRate,
          aiBonus,
          confidence,
          row.id,
        ]
      );

      updated++;
    }

    return NextResponse.json({
      success: true,
      aiPowerVersion:
        "V13.2_SECTOR_JUDGE",
      updated,
      apiTimeMs:
        Date.now() - startedAt,
    });
  } catch (error) {
    console.error(
      "sector judge error:",
      error
    );

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