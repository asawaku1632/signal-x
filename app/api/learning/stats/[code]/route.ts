import { NextResponse } from "next/server";

import { getDailyStockResults } from "@/app/lib/dailyLearning";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    const results = await getDailyStockResults();

    const filtered = results.filter(
      (item) => item.code === code
    );

    const judged = filtered.filter(
      (item) =>
        item.result === "WIN" ||
        item.result === "LOSE"
    );

    const win = judged.filter(
      (item) => item.result === "WIN"
    ).length;

    const lose = judged.filter(
      (item) => item.result === "LOSE"
    ).length;

    const hold = filtered.filter(
      (item) => item.result === "HOLD"
    ).length;

    const winRate =
      judged.length > 0
        ? Math.round((win / judged.length) * 100)
        : 0;

    return NextResponse.json({
      success: true,
      code,
      total: filtered.length,
      judgedTotal: judged.length,
      win,
      lose,
      hold,
      winRate,
      latest: filtered[0] || null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}