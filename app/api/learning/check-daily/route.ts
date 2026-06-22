import { NextResponse } from "next/server";

import {
  getDailyStockResults,
  updateDailyStockResult,
} from "@/app/lib/dailyLearning";

type Stock = {
  code: string;
  price?: number;
};

function judgeResult(
  entryPrice: number,
  nextPrice: number
): "WIN" | "LOSE" | "HOLD" {
  const changePercent =
    ((nextPrice - entryPrice) / entryPrice) * 100;

  if (changePercent >= 2) return "WIN";
  if (changePercent <= -2) return "LOSE";
  return "HOLD";
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const baseUrl = url.origin;

    const targetDate =
      url.searchParams.get("date") ||
      new Date().toISOString().split("T")[0];

    const scanRes = await fetch(`${baseUrl}/api/scan?limit=1000`, {
      cache: "no-store",
    });

    const scanJson = await scanRes.json();
    const stocks: Stock[] = scanJson.stocks || [];

    const results = await getDailyStockResults();

    const targets = results.filter(
      (item) =>
        item.date === targetDate &&
        item.result === "UNKNOWN"
    );

    let checked = 0;
    let win = 0;
    let lose = 0;
    let hold = 0;
    let skipped = 0;

    for (const item of targets) {
      const current = stocks.find(
        (stock) => stock.code === item.code
      );

      const nextPrice = current?.price ?? 0;

      if (nextPrice <= 0) {
        skipped += 1;
        continue;
      }

      const changePercent =
        Math.round(
          ((nextPrice - item.price) / item.price) * 10000
        ) / 100;

      const result = judgeResult(item.price, nextPrice);

      await updateDailyStockResult(item.id, {
        nextPrice,
        changePercent,
        result,
      });

      checked += 1;

      if (result === "WIN") win += 1;
      if (result === "LOSE") lose += 1;
      if (result === "HOLD") hold += 1;
    }

    return NextResponse.json({
      success: true,
      date: targetDate,
      targetCount: targets.length,
      checked,
      skipped,
      win,
      lose,
      hold,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: "check daily failed",
        message: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}