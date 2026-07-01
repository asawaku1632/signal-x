import { NextResponse } from "next/server";

import { getDailyStockResults } from "@/app/lib/dailyLearning";

export async function GET() {
  const start = Date.now();

  try {
    const results = await getDailyStockResults();

    const win = results.filter((item) => item.result === "WIN").length;
    const lose = results.filter((item) => item.result === "LOSE").length;
    const hold = results.filter((item) => item.result === "HOLD").length;
    const unknown = results.filter((item) => item.result === "UNKNOWN").length;

    const judged = win + lose;
    const winRate =
      judged > 0 ? Number(((win / judged) * 100).toFixed(2)) : 0;

    const status = results.length > 0 ? "PASS" : "FAIL";

    return NextResponse.json({
      success: true,
      status,
      dailyResults: results.length,
      win,
      lose,
      hold,
      unknown,
      judged,
      winRate,
      apiTimeMs: Date.now() - start,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        status: "FAIL",
        error: "LEARNING_VERIFICATION_FAILED",
        message: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}