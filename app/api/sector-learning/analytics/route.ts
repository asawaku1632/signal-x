import { NextResponse } from "next/server";
import pool from "@/app/lib/postgres";

function calculateBonus(winRate: number, total: number) {
  if (total < 10) return 0;

  if (winRate >= 90) return 8;
  if (winRate >= 80) return 5;
  if (winRate >= 70) return 3;
  if (winRate >= 60) return 1;
  if (winRate >= 45) return 0;
  if (winRate >= 35) return -2;
  if (winRate >= 25) return -5;

  return -8;
}

export async function GET() {
  try {
    const { rows } = await pool.query(`
      SELECT
        sector_key,
        sector_name,
        SUM(win_count)::int AS win,
        SUM(lose_count)::int AS lose,
        SUM(judged_count)::int AS total
      FROM sector_learning_logs
      GROUP BY sector_key, sector_name
      ORDER BY total DESC
    `);

    const sectors = rows.map((row) => {
      const win = Number(row.win ?? 0);
      const lose = Number(row.lose ?? 0);
      const total = Number(row.total ?? win + lose);
      const winRate = total > 0 ? Math.round((win / total) * 100) : 0;
      const recommendedBonus = calculateBonus(winRate, total);

      return {
        sectorKey: row.sector_key,
        sectorName: row.sector_name,
        win,
        lose,
        total,
        winRate,
        recommendedBonus,
        evaluation:
          total < 10
            ? "NOT_ENOUGH_DATA"
            : winRate >= 80
            ? "STRONG_SECTOR"
            : winRate >= 60
            ? "GOOD_SECTOR"
            : winRate >= 45
            ? "KEEP"
            : "WEAK_SECTOR",
      };
    });

    return NextResponse.json({
      success: true,
      aiPowerVersion: "V13.0_SECTOR_CYCLE_ANALYTICS",
      count: sectors.length,
      sectors,
    });
  } catch (error) {
    console.error("sector analytics error:", error);

    return NextResponse.json(
      {
        success: false,
        aiPowerVersion: "V13.0_SECTOR_CYCLE_ANALYTICS",
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}