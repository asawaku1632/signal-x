import { NextResponse } from "next/server";
import pool from "@/app/lib/postgres";

export async function GET() {
  try {
    const { rows } = await pool.query(`
      SELECT
        experience_key,
        result
      FROM experience_learning_logs
      WHERE result IN ('WIN', 'LOSE')
    `);

    const analytics = {
      rsi: {} as Record<string, { win: number; lose: number; total: number; winRate: number }>,
      macd: {} as Record<string, { win: number; lose: number; total: number; winRate: number }>,
      trend: {} as Record<string, { win: number; lose: number; total: number; winRate: number }>,
    };

    for (const row of rows) {
      const parts = String(row.experience_key).split("|");

      const rsi = parts[0];
      const macd = parts[1];
      const trend = parts[4];

      const result = row.result;

      for (const [group, key] of [
        [analytics.rsi, rsi],
        [analytics.macd, macd],
        [analytics.trend, trend],
      ] as const) {
        if (!group[key]) {
          group[key] = {
            win: 0,
            lose: 0,
            total: 0,
            winRate: 0,
          };
        }

        group[key].total++;

        if (result === "WIN") group[key].win++;
        else group[key].lose++;
      }
    }

    for (const group of [
      analytics.rsi,
      analytics.macd,
      analytics.trend,
    ]) {
      Object.values(group).forEach((item) => {
        item.winRate =
          item.total === 0
            ? 0
            : Math.round((item.win / item.total) * 100);
      });
    }

    return NextResponse.json({
      success: true,
      analytics,
    });
  } catch (e) {
    console.error(e);

    return NextResponse.json({
      success: false,
    });
  }
}