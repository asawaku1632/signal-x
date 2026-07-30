import { NextResponse } from "next/server";

import {
  getDailyStockResults,
  type DailyStockResult,
} from "@/app/lib/dailyLearning";

export const dynamic = "force-dynamic";

type StatsSummary = {
  total: number;
  win: number;
  lose: number;
  hold: number;
  judged: number;
  winRate: number | null;
  cumulativeProfit: number | null;
};

function summarize(results: DailyStockResult[]): StatsSummary {
  const win = results.filter((item) => item.result === "WIN").length;
  const lose = results.filter((item) => item.result === "LOSE").length;
  const hold = results.filter((item) => item.result === "HOLD").length;
  const judged = win + lose;
  const profitResults = results.filter(
    (item) =>
      item.result !== "UNKNOWN" &&
      item.nextPrice !== null &&
      Number.isFinite(item.price) &&
      Number.isFinite(item.nextPrice),
  );

  return {
    total: results.length,
    win,
    lose,
    hold,
    judged,
    winRate:
      judged > 0 ? Math.round((win / judged) * 1000) / 10 : null,
    cumulativeProfit:
      profitResults.length > 0
        ? Math.round(
            profitResults.reduce(
              (sum, item) => sum + ((item.nextPrice ?? item.price) - item.price) * 100,
              0,
            ),
          )
        : null,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;

  if (!/^\d{4}$/.test(code)) {
    return NextResponse.json(
      { success: false, error: "invalid_code" },
      { status: 400 },
    );
  }

  try {
    const results = (await getDailyStockResults()).filter(
      (item) => item.code === code,
    );
    const all = summarize(results);
    const recent30 = summarize(results.slice(0, 30));

    return NextResponse.json({
      success: true,
      code,
      ...all,
      recent30,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "stats_unavailable" },
      { status: 500 },
    );
  }
}
