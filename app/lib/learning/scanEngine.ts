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
import { buildRanking } from "@/app/lib/learning/rankingEngine";
import { getSectorKey } from "@/app/lib/sectorMap";
import { createExperienceKey } from "@/app/lib/experienceLearning";
import { getExperienceBonusMap } from "@/app/lib/experienceBonus";
import { getSimilarExperienceBonusMap } from "@/app/lib/similarExperience";
import { getExperienceRankingMap } from "@/app/lib/experienceRanking";

const BATCH_SIZE = 20;
const MAX_SCAN_LIMIT = 1200;

export type ScanResult = {
  limit: number;
  totalStockList: number;
  marketPattern?: string;
  stocks: any[];
  ranking: any;
  batchSize: number;
};

export function getUniqueStocks(stocks: Stock[]) {
  const map = new Map<string, Stock>();

  for (const stock of stocks) {
    if (!map.has(stock.code)) {
      map.set(stock.code, stock);
    }
  }

  return Array.from(map.values());
}

export function clampLimit(value: number) {
  if (!Number.isFinite(value)) return 200;
  if (value < 1) return 200;
  if (value > MAX_SCAN_LIMIT) return MAX_SCAN_LIMIT;
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

export async function runScan(limit: number): Promise<ScanResult> {
  const uniqueStocks = getUniqueStocks(ACTIVE_STOCKS);
  const targetStocks = uniqueStocks.slice(0, limit);
  const targetCodes = targetStocks.map((stock) => stock.code);

  const learningStatsMap = await getLearningStatsMap(targetCodes);

  const marketPattern = await getLatestMarketPattern();
  const latestMarketBonus = await getLatestMarketBonus();
  const timeLearning = await getLearningTimeBonus();

  const rawScored = await runInBatches(
    targetStocks,
    BATCH_SIZE,
    async (stock) => {
      return analyzeStock(stock);
    }
  );

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

  const analyzedStocks = await Promise.all(
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
  );

  const ranking = buildRanking(analyzedStocks);

  return {
    limit,
    totalStockList: uniqueStocks.length,
    marketPattern,
    stocks: ranking.rankedStocks,
    ranking,
    batchSize: BATCH_SIZE,
  };
}

export function getFallbackTotalStockList() {
  return getUniqueStocks(STOCKS).length;
}