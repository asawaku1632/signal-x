import { NextResponse } from "next/server";
import db from "@/app/lib/db";

export async function GET() {
  try {
    const rows = db
      .prepare(`
        SELECT *
        FROM learning_logs
        WHERE result IN ('win', 'lose')
      `)
      .all() as any[];

    const total = rows.length;
    const wins = rows.filter((row) => row.result === "win").length;
    const loses = rows.filter((row) => row.result === "lose").length;

    const winRate =
      total === 0 ? 0 : Math.round((wins / total) * 100);

    const patternStats: Record<
      string,
      { total: number; wins: number; loses: number; winRate: number }
    > = {};

    for (const row of rows) {
      const reasons = String(row.reason || "")
        .split("/")
        .map((r) => r.trim())
        .filter(Boolean);

      for (const reason of reasons) {
        if (!patternStats[reason]) {
          patternStats[reason] = {
            total: 0,
            wins: 0,
            loses: 0,
            winRate: 0,
          };
        }

        patternStats[reason].total += 1;

        if (row.result === "win") patternStats[reason].wins += 1;
        if (row.result === "lose") patternStats[reason].loses += 1;
      }
    }

    for (const key of Object.keys(patternStats)) {
      const item = patternStats[key];
      item.winRate =
        item.total === 0
          ? 0
          : Math.round((item.wins / item.total) * 100);
    }

    return NextResponse.json({
      success: true,
      total,
      wins,
      loses,
      winRate,
      patternStats,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: "learning stats failed",
      },
      { status: 500 }
    );
  }
}