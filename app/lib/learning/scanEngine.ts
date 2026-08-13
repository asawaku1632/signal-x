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
  diagnostics: ScanDiagnostics;
};

export type ScanDiagnostics = {
  targetStockCount: number;
  analyzedSuccessCount: number;
  analyzedFailureCount: number;
  failedStockCodes: string[];
  errorTypes: Record<string, number>;
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
  const failures: { item: T; errorType: string }[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const settled = await Promise.allSettled(batch.map(fn));

    for (const [index, result] of settled.entries()) {
      if (result.status === "fulfilled" && result.value) {
        results.push(result.value);
      } else {
        const reason = result.status === "rejected" ? result.reason : null;
        const errorName = reason instanceof Error ? reason.name : "EmptyResult";
        failures.push({ item: batch[index], errorType: errorName || "Error" });
      }
    }
  }

  return { results, failures };
}

export async function runScan(limit: number): Promise<ScanResult> {
  const uniqueStocks = getUniqueStocks(ACTIVE_STOCKS);
  const targetStocks = uniqueStocks.slice(0, limit);
  return runScanForTargets(targetStocks, uniqueStocks.length, limit);
}

export async function runSingleStockScan(code: string): Promise<ScanResult> {
  const uniqueStocks = getUniqueStocks(ACTIVE_STOCKS);
  const stock = uniqueStocks.find((item) => item.code === code);
  if (!stock) {
    return {
      limit: 1,
      totalStockList: uniqueStocks.length,
      stocks: [],
      ranking: buildRanking([]),
      batchSize: BATCH_SIZE,
      diagnostics: {
        targetStockCount: 0,
        analyzedSuccessCount: 0,
        analyzedFailureCount: 0,
        failedStockCodes: [],
        errorTypes: {},
      },
    };
  }
  return runScanForTargets([stock], uniqueStocks.length, 1);
}

async function runScanForTargets(
  targetStocks: Stock[],
  totalStockList: number,
  limit: number,
): Promise<ScanResult> {
  const targetCodes = targetStocks.map((stock) => stock.code);

  const [learningStatsMap, marketPattern, latestMarketBonus, timeLearning] =
    await Promise.all([
      getLearningStatsMap(targetCodes),
      getLatestMarketPattern(),
      getLatestMarketBonus(),
      getLearningTimeBonus(),
    ]);

  const analysis = await runInBatches(
    targetStocks,
    BATCH_SIZE,
    async (stock) => {
      return analyzeStock(stock);
    }
  );

  const validScored = analysis.results.filter(Boolean) as any[];
  const errorTypes = analysis.failures.reduce<Record<string, number>>(
    (summary, failure) => {
      summary[failure.errorType] = (summary[failure.errorType] ?? 0) + 1;
      return summary;
    },
    {},
  );
  const diagnostics: ScanDiagnostics = {
    targetStockCount: targetStocks.length,
    analyzedSuccessCount: validScored.length,
    analyzedFailureCount: analysis.failures.length,
    failedStockCodes: analysis.failures
      .slice(0, 20)
      .map((failure) => String((failure.item as Stock).code)),
    errorTypes,
  };

  if (diagnostics.analyzedFailureCount > 0) {
    console.warn(
      JSON.stringify({ service: "scan-engine", event: "analysis-failures", ...diagnostics }),
    );
  }

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
    totalStockList,
    marketPattern,
    stocks: ranking.rankedStocks,
    ranking,
    batchSize: BATCH_SIZE,
    diagnostics,
  };
}

export function getFallbackTotalStockList() {
  return getUniqueStocks(STOCKS).length;
}
