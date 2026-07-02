import { NextResponse } from "next/server";

import pool from "@/app/lib/postgres";
import { saveDailyStocks } from "@/app/lib/dailyLearning";

type PatternLearning = {
  rsiBand?: string;
  trendKey?: string;
  ema20Key?: string;
  vwapKey?: string;
  macdKey?: string;
  patternKey?: string;
};

type Stock = {
  code: string;
  name: string;
  score?: number;
  aiPower?: number;
  price?: number;
  patternLearning?: PatternLearning;
  patternKey?: string;
};

async function savePatternLearningLogs(stocks: Stock[]) {
  const targets = stocks.filter((stock) => {
    return (
      stock.code &&
      stock.name &&
      stock.patternKey &&
      stock.patternLearning &&
      typeof (stock.aiPower ?? stock.score) === "number" &&
      typeof stock.price === "number"
    );
  });

  if (targets.length === 0) {
    return {
      patternAdded: 0,
    };
  }

  const values: any[] = [];
  const placeholders: string[] = [];

  targets.forEach((stock, index) => {
    const base = index * 10;
    const pattern = stock.patternLearning!;

    values.push(
      stock.code,
      stock.name,
      stock.patternKey,
      pattern.rsiBand ?? null,
      pattern.macdKey ?? null,
      pattern.vwapKey ?? null,
      pattern.ema20Key ?? null,
      pattern.trendKey ?? null,
      stock.aiPower ?? stock.score,
      stock.price
    );

    placeholders.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${
        base + 5
      }, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${
        base + 10
      })`
    );
  });

  await pool.query(
    `
    INSERT INTO pattern_learning_logs (
      code,
      name,
      pattern_key,
      rsi_band,
      macd_key,
      vwap_key,
      ema20_key,
      trend_key,
      ai_power,
      entry_price
    )
    VALUES ${placeholders.join(",")}
    `,
    values
  );

  return {
    patternAdded: targets.length,
  };
}

export async function GET(req: Request) {
  try {
    const siteUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

    const scanRes = await fetch(`${siteUrl}/api/scan?limit=1000`, {
      cache: "no-store",
    });

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

    const stocks: Stock[] = scanJson.stocks || [];

    const today = new Date().toISOString().split("T")[0];

    const result = await saveDailyStocks(today, stocks);

    const patternResult = await savePatternLearningLogs(stocks);

    return NextResponse.json({
      success: true,
      date: today,
      stockCount: stocks.length,
      ...result,
      ...patternResult,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: "save daily failed",
        message: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}