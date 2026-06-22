import { NextResponse } from "next/server";

import { saveDailyStocks } from "@/app/lib/dailyLearning";

type Stock = {
  code: string;
  name: string;
  score?: number;
  aiPower?: number;
  price?: number;
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const baseUrl = url.origin;

    const scanRes = await fetch(
      `${baseUrl}/api/scan?limit=1000`,
      {
        cache: "no-store",
      }
    );

    if (!scanRes.ok) {
      return NextResponse.json(
        {
          success: false,
          error: "scan api failed",
        },
        { status: 500 }
      );
    }

    const scanJson = await scanRes.json();

    const stocks: Stock[] =
      scanJson.stocks || [];

    const today =
      new Date().toISOString().split("T")[0];

    const result =
      await saveDailyStocks(
        today,
        stocks
      );

    return NextResponse.json({
      success: true,
      date: today,
      stockCount: stocks.length,
      ...result,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: "save daily failed",
        message:
          error?.message ||
          String(error),
      },
      { status: 500 }
    );
  }
}