import { NextResponse } from "next/server";

import { getDailyStockResults } from "@/app/lib/dailyLearning";

export async function GET() {
  try {
    const results = await getDailyStockResults();

    const stats: Record<
      string,
      {
        code: string;
        name: string;
        total: number;
        win: number;
        lose: number;
        hold: number;
        winRate: number;
      }
    > = {};

    for (const item of results) {
      if (!stats[item.code]) {
        stats[item.code] = {
          code: item.code,
          name: item.name,
          total: 0,
          win: 0,
          lose: 0,
          hold: 0,
          winRate: 0,
        };
      }

      stats[item.code].total++;

      if (item.result === "WIN") stats[item.code].win++;
      if (item.result === "LOSE") stats[item.code].lose++;
      if (item.result === "HOLD") stats[item.code].hold++;
    }

    const ranking = Object.values(stats)
      .map((item) => {
        const judged = item.win + item.lose;

        return {
          ...item,
          winRate:
            judged > 0
              ? Math.round((item.win / judged) * 100)
              : 0,
        };
      })
      .filter(
  (item) =>
    item.win + item.lose >= 3
)
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, 20);

    return NextResponse.json({
      success: true,
      count: ranking.length,
      ranking,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}