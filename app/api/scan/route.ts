import { NextResponse } from "next/server";
import { STOCKS, type Stock } from "@/app/lib/stockList";
import { ACTIVE_STOCKS } from "@/app/lib/activeStockList";
import {
  getLatestMarketPattern,
  getLatestMarketBonus,
  getLearningStatsMap,
  getPatternStatsMap,
  getWeightRuleMap,
  getSectorWeightRuleMap,
  getSectorStatsMap,
} from "@/app/lib/learning/database";
import { getLearningTimeBonus } from "@/app/lib/learning";
import { runAiPipeline } from "@/app/lib/learning/pipeline";
import { analyzeStock } from "@/app/lib/learning/stockAnalyzer";
import { getSectorKey } from "@/app/lib/sectorMap";
import { createExperienceKey } from "@/app/lib/experienceLearning";
import { getExperienceBonusMap } from "@/app/lib/experienceBonus";
import { getSimilarExperienceBonusMap } from "@/app/lib/similarExperience";
import { getExperienceRankingMap } from "@/app/lib/experienceRanking";

export const dynamic = "force-dynamic";

const DEBUG_VERSION = "AI_POWER_V17_STOCK_ANALYZER_0706";

const BATCH_SIZE = 20;
const CACHE_TIME = 60 * 1000;

type CacheData = {
  timestamp: number;
  limit: number;
  stocks: any[];
};

let cacheData: CacheData | null = null;

function getUniqueStocks(stocks: Stock[]) {
  const map = new Map<string, Stock>();

  for (const stock of stocks) {
    if (!map.has(stock.code)) {
      map.set(stock.code, stock);
    }
  }

  return Array.from(map.values());
}

function clampLimit(value: number) {
  if (!Number.isFinite(value)) return 200;
  if (value < 1) return 200;
  if (value > 1000) return 1000;
  return value;
}

async function runInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>
) {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const settled = await Promise.allSettled(batch.map(fn));

    for (const result of settled) {
      if (result.status === "fulfilled") {
        results.push(result.value);
      }
    }
  }

  return results;
}

export async function GET(req: Request) {
  const startedAt = Date.now();
  const now = Date.now();

  try {
    const { searchParams } = new URL(req.url);
    const limit = clampLimit(Number(searchParams.get("limit") || 200));

    if (
      cacheData &&
      cacheData.limit === limit &&
      now - cacheData.timestamp < CACHE_TIME
    ) {
      return NextResponse.json({
        success: true,
        cached: true,
        debugVersion: DEBUG_VERSION,
        aiPowerVersion: "V17.0",
        learningBonusEnabled: true,
        patternBonusEnabled: true,
        weightRulesEnabled: true,
        sectorEnabled: true,
        sectorBonusEnabled: true,
        sectorWeightRuleEnabled: true,
        experienceBonusEnabled: true,
        similarExperienceEnabled: true,
        experienceRankingEnabled: true,
        aiPipelineEnabled: true,
        stockAnalyzerEnabled: true,
        cacheAge: Math.floor((now - cacheData.timestamp) / 1000),
        count: cacheData.stocks.length,
        requestedLimit: limit,
        totalStockList: getUniqueStocks(STOCKS).length,
        stocks: cacheData.stocks,
      });
    }

    const uniqueStocks = getUniqueStocks(ACTIVE_STOCKS);
    const targetStocks = uniqueStocks.slice(0, limit);
    const targetCodes = targetStocks.map((stock) => stock.code);

    const learningStatsMap = await getLearningStatsMap(targetCodes);

    const marketPattern = await getLatestMarketPattern();
    const latestMarketBonus = await getLatestMarketBonus();
    const timeLearning = await getLearningTimeBonus();

    const rawScored = await runInBatches(targetStocks, BATCH_SIZE, async (stock) => {
      return analyzeStock(stock);
    });

    const validScored = rawScored.filter(Boolean) as any[];

    const patternKeys = validScored.map((stock) => stock.patternKey);
    const sectorKeys = validScored.map((stock) => getSectorKey(stock.code));

    const experienceKeys = validScored.map((stock) => {
      const sectorKey = getSectorKey(stock.code);

      return createExperienceKey({
        patternKey: stock.patternKey,
        sectorKey,
        marketPattern,
      });
    });

    const [
      patternStatsMap,
      weightRuleMap,
      sectorStatsMap,
      sectorWeightRuleMap,
      experienceBonusMap,
      similarExperienceBonusMap,
      experienceRankingMap,
    ] = await Promise.all([
      getPatternStatsMap(patternKeys),
      getWeightRuleMap(patternKeys),
      getSectorStatsMap(sectorKeys),
      getSectorWeightRuleMap(sectorKeys),
      getExperienceBonusMap(experienceKeys),
      getSimilarExperienceBonusMap(experienceKeys, {
        minSimilarity: 70,
        limit: 300,
      }),
      getExperienceRankingMap(experienceKeys, {
        minSimilarity: 70,
        candidateLimit: 500,
        topLimit: 10,
      }),
    ]);

    const stocks = (
      await Promise.all(
        validScored.map(async (scored: any) =>
          runAiPipeline({
            scored,
            marketPattern,
            latestMarketBonus,
            timeLearning,
            learningStatsMap,
            patternStatsMap,
            weightRuleMap,
            sectorStatsMap,
            sectorWeightRuleMap,
            experienceBonusMap,
            similarExperienceBonusMap,
            experienceRankingMap,
          })
        )
      )
    ).sort((a: any, b: any) => b.score - a.score);

    cacheData = {
      timestamp: Date.now(),
      limit,
      stocks,
    };

    const firstStock = stocks[0];
    const marketLearning = firstStock?.scoreBreakdown?.marketLearning;
    const timeLearningResult = firstStock?.scoreBreakdown?.timeLearning;

    return NextResponse.json({
      success: true,
      cached: false,
      debugVersion: DEBUG_VERSION,
      aiPowerVersion: "V17.0",
      stockAnalyzerEnabled: true,
      marketPattern,
      marketBonus: marketLearning?.bonus ?? 0,
      marketWinRate: marketLearning?.winRate ?? 0,
      marketConfidence: marketLearning?.confidence ?? 0,
      marketBonusSource: marketLearning?.source ?? "fixed",
      timeBonus: timeLearningResult?.bonus ?? 0,
      count: stocks.length,
      requestedLimit: limit,
      totalStockList: uniqueStocks.length,
      scanMs: Date.now() - startedAt,
      batchSize: BATCH_SIZE,
      stocks,
    });
  } catch (error) {
    if (cacheData) {
      return NextResponse.json({
        success: true,
        cached: true,
        fallback: true,
        debugVersion: DEBUG_VERSION,
        aiPowerVersion: "V17.0",
        stockAnalyzerEnabled: true,
        error: String(error),
        count: cacheData.stocks.length,
        requestedLimit: cacheData.limit,
        stocks: cacheData.stocks,
      });
    }

    return NextResponse.json(
      {
        success: false,
        cached: false,
        debugVersion: DEBUG_VERSION,
        stockAnalyzerEnabled: true,
        stocks: [],
        error: String(error),
      },
      { status: 500 }
    );
  }
}
