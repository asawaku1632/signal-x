import { NextResponse } from "next/server";

import pool from "@/app/lib/postgres";
import { saveDailyStocks } from "@/app/lib/dailyLearning";
import { saveSectorLearning } from "@/app/lib/sectorLearning";
import { saveMarketLearning } from "@/app/lib/marketLearning";
import { saveExperienceLearning } from "@/app/lib/experienceLearning";
import { runScan } from "@/app/lib/learning/scanEngine";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

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
  changePercent?: number;
  result?: string;
  patternLearning?: PatternLearning;
  patternKey?: string;
};

async function savePatternLearningLogs(stocks: Stock[]) {
  const targets = stocks.filter(
    (stock) =>
      stock.code &&
      stock.name &&
      stock.patternKey &&
      stock.patternLearning &&
      typeof (stock.aiPower ?? stock.score) === "number" &&
      typeof stock.price === "number"
  );

  if (targets.length === 0) return { patternAdded: 0 };

  const values: unknown[] = [];
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
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10})`
    );
  });

  await pool.query(
    `
      INSERT INTO pattern_learning_logs (
        code,name,pattern_key,rsi_band,macd_key,vwap_key,
        ema20_key,trend_key,ai_power,entry_price
      )
      VALUES ${placeholders.join(",")}
    `,
    values
  );

  return { patternAdded: targets.length };
}

export async function GET() {
  const startedAt = Date.now();

  try {
    const scanStartedAt = Date.now();
    const scanResult = await runScan(1000);
    const stocks = scanResult.stocks as Stock[];
    const scanMs = Date.now() - scanStartedAt;

    if (stocks.length === 0) {
      return NextResponse.json(
        {
          success: false,
          route: "save-daily-lite",
          error: "scan returned no stocks",
          scanMs,
          totalMs: Date.now() - startedAt,
        },
        { status: 500 }
      );
    }

    const today = new Date().toISOString().split("T")[0];

    const dailyStartedAt = Date.now();
    const result = await saveDailyStocks(today, stocks);
    const dailySaveMs = Date.now() - dailyStartedAt;

    const added = Number(result.added ?? 0);
    const skipped = Number(result.skipped ?? 0);

    if (added === 0 && skipped >= stocks.length) {
      return NextResponse.json({
        success: true,
        route: "save-daily-lite",
        date: today,
        stockCount: stocks.length,
        alreadySaved: true,
        message: "当日分は保存済みのため、後続学習をスキップしました。",
        timing: {
          scanMs,
          dailySaveMs,
          patternSaveMs: 0,
          sectorSaveMs: 0,
          marketSaveMs: 0,
          experienceSaveMs: 0,
          totalMs: Date.now() - startedAt,
        },
        ...result,
      });
    }

    const patternStartedAt = Date.now();
    const patternResult = await savePatternLearningLogs(stocks);
    const patternSaveMs = Date.now() - patternStartedAt;

    const sectorStartedAt = Date.now();
    const sectorResult = await saveSectorLearning(today, stocks);
    const sectorSaveMs = Date.now() - sectorStartedAt;

    const marketStartedAt = Date.now();
    const marketResult = await saveMarketLearning({
      tradeDate: today,
      stocks,
    });
    const marketSaveMs = Date.now() - marketStartedAt;

    const experienceStartedAt = Date.now();
    const experienceResult = await saveExperienceLearning({
      tradeDate: today,
      stocks,
      marketPattern: marketResult.market.marketPattern,
    });
    const experienceSaveMs = Date.now() - experienceStartedAt;

    return NextResponse.json({
      success: true,
      route: "save-daily-lite",
      date: today,
      stockCount: stocks.length,
      timing: {
        scanMs,
        dailySaveMs,
        patternSaveMs,
        sectorSaveMs,
        marketSaveMs,
        experienceSaveMs,
        totalMs: Date.now() - startedAt,
      },
      ...result,
      ...patternResult,
      ...sectorResult,
      ...marketResult,
      ...experienceResult,
    });
  } catch (error: unknown) {
    console.error("[save-daily-lite] failed", error);

    return NextResponse.json(
      {
        success: false,
        route: "save-daily-lite",
        error: "save daily lite failed",
        message: error instanceof Error ? error.message : String(error),
        totalMs: Date.now() - startedAt,
      },
      { status: 500 }
    );
  }
}