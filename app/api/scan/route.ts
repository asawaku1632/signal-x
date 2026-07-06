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
import {
  buildScanErrorPayload,
  buildScanResponsePayload,
} from "@/app/lib/learning/notificationEngine";
import { getSectorKey } from "@/app/lib/sectorMap";
import { createExperienceKey } from "@/app/lib/experienceLearning";
import { getExperienceBonusMap } from "@/app/lib/experienceBonus";
import { getSimilarExperienceBonusMap } from "@/app/lib/similarExperience";
import { getExperienceRankingMap } from "@/app/lib/experienceRanking";

export const dynamic = "force-dynamic";

const DEBUG_VERSION = "AI_POWER_V18_NOTIFICATION_ENGINE_0706";
const AI_POWER_VERSION = "V18.0";

const BATCH_SIZE = 20;
const CACHE_TIME = 60 * 1000;

type CacheData = {
  timestamp: number;
  limit: number;
  stocks: any[];
  marketPattern?: string;
  totalStockList?: number;
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
      return NextResponse.json(
        buildScanResponsePayload({
          debugVersion: DEBUG_VERSION,
          aiPowerVersion: AI_POWER_VERSION,
          cached: true,
          limit,
          totalStockList: cacheData.totalStockList ?? getUniqueStocks(STOCKS).length,
          stocks: cacheData.stocks,
          marketPattern: cacheData.marketPattern,
          cacheAge: Math.floor((now - cacheData.timestamp) / 1000),
        })
      );
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
      marketPattern,
      totalStockList: uniqueStocks.length,
    };

    return NextResponse.json(
      buildScanResponsePayload({
        debugVersion: DEBUG_VERSION,
        aiPowerVersion: AI_POWER_VERSION,
        cached: false,
        limit,
        totalStockList: uniqueStocks.length,
        stocks,
        marketPattern,
        scanMs: Date.now() - startedAt,
        batchSize: BATCH_SIZE,
      })
    );
  } catch (error) {
    if (cacheData) {
      return NextResponse.json(
        buildScanResponsePayload({
          debugVersion: DEBUG_VERSION,
          aiPowerVersion: AI_POWER_VERSION,
          cached: true,
          fallback: true,
          limit: cacheData.limit,
          totalStockList: cacheData.totalStockList,
          stocks: cacheData.stocks,
          marketPattern: cacheData.marketPattern,
          error: String(error),
        })
      );
    }

    return NextResponse.json(buildScanErrorPayload(DEBUG_VERSION, error), {
      status: 500,
    });
  }
}
