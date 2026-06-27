import { NextResponse } from "next/server";

import { getDailyStockResults } from "@/app/lib/dailyLearning";

export async function GET() {
  try {
    const results = await getDailyStockResults();

    const total = results.length;

    const unknown = results.filter(
      (item) => item.result === "UNKNOWN"
    ).length;

    const win = results.filter(
      (item) => item.result === "WIN"
    ).length;

    const lose = results.filter(
      (item) => item.result === "LOSE"
    ).length;

    const hold = results.filter(
      (item) => item.result === "HOLD"
    ).length;

    const checked = win + lose + hold;

    const judged = win + lose;

    const winRate =
      judged > 0
        ? Math.round((win / judged) * 100)
        : 0;

    const dates = Array.from(
      new Set(results.map((item) => item.date))
    ).sort();

    return NextResponse.json({
      success: true,
      total,
      checked,
      unknown,
      win,
      lose,
      hold,
      judged,
      winRate,
      dateCount: dates.length,
      firstDate: dates[0] || null,
      latestDate: dates[dates.length - 1] || null,
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