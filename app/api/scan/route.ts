import { NextResponse } from "next/server";
import { STOCKS, type Stock } from "@/app/lib/stockList";
import { ACTIVE_STOCKS } from "@/app/lib/activeStockList";
import {
  calculateAiScore,
  clampScore,
  type ChartAnalysis,
} from "@/app/lib/aiEngine";
import { calculateLearningBonus } from "@/app/lib/learningBonus";
import { calculatePatternBonus } from "@/app/lib/patternBonus";
import { calculateSectorBonus } from "@/app/lib/sectorBonus";
import { getSectorKey, getSectorLabel } from "@/app/lib/sectorMap";
import { createExperienceKey } from "@/app/lib/experienceLearning";
import { getExperienceBonusMap } from "@/app/lib/experienceBonus";
import { getSimilarExperienceBonusMap } from "@/app/lib/similarExperience";
import { getExperienceRankingMap } from "@/app/lib/experienceRanking";
import pool from "@/app/lib/postgres";

export const dynamic = "force-dynamic";

const DEBUG_VERSION = "AI_POWER_V13_4_SECTOR_WEIGHT_RULE_0704";

type CacheData = {
  timestamp: number;
  limit: number;
  stocks: any[];
};

type LearningStats = {
  code: string;
  win: number;
  lose: number;
  winRate: number;
};

type PatternStats = {
  patternKey: string;
  win: number;
  lose: number;
};

type WeightRule = {
  ruleKey: string;
  bonus: number;
  winRate: number;
  sampleCount: number;
  confidence: number;
};

type SectorWeightRule = {
  ruleKey: string;
  bonus: number;
  winRate: number;
  sampleCount: number;
  confidence: number;
};

type SectorStats = {
  sectorKey: string;
  win: number;
  lose: number;
};

let cacheData: CacheData | null = null;

const CACHE_TIME = 60 * 1000;

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

async function getLatestMarketPattern() {
  const { rows } = await pool.query(
    `
    SELECT market_pattern
    FROM market_learning_logs
    WHERE market_pattern IS NOT NULL
    ORDER BY trade_date DESC
    LIMIT 1
    `
  );

  return rows[0]?.market_pattern
    ? String(rows[0].market_pattern)
    : "NO_MARKET";
}

async function getLearningStatsMap(codes: string[]) {
  const map = new Map<string, LearningStats>();

  if (codes.length === 0) return map;

  const { rows } = await pool.query(
    `
    SELECT
      code,
      SUM(CASE WHEN result = 'WIN' THEN 1 ELSE 0 END) AS win,
      SUM(CASE WHEN result = 'LOSE' THEN 1 ELSE 0 END) AS lose
    FROM daily_stock_results
    WHERE code = ANY($1)
    GROUP BY code
    `,
    [codes]
  );

  for (const row of rows) {
    const code = String(row.code);
    const win = Number(row.win || 0);
    const lose = Number(row.lose || 0);
    const judged = win + lose;
    const winRate = judged === 0 ? 0 : Math.round((win / judged) * 100);

    map.set(code, {
      code,
      win,
      lose,
      winRate,
    });
  }

  return map;
}
async function getPatternStatsMap(patternKeys: string[]) {
  const map = new Map<string, PatternStats>();
  const uniqueKeys = Array.from(new Set(patternKeys.filter(Boolean)));

  if (uniqueKeys.length === 0) return map;

  const { rows } = await pool.query(
    `
    SELECT
      pattern_key,
      SUM(CASE WHEN result = 'WIN' THEN 1 ELSE 0 END) AS win,
      SUM(CASE WHEN result = 'LOSE' THEN 1 ELSE 0 END) AS lose
    FROM pattern_learning_logs
    WHERE pattern_key = ANY($1)
    GROUP BY pattern_key
    `,
    [uniqueKeys]
  );

  for (const row of rows) {
    const patternKey = String(row.pattern_key);
    const win = Number(row.win || 0);
    const lose = Number(row.lose || 0);

    map.set(patternKey, {
      patternKey,
      win,
      lose,
    });
  }

  return map;
}

async function getWeightRuleMap(patternKeys: string[]) {
  const map = new Map<string, WeightRule>();
  const uniqueKeys = Array.from(new Set(patternKeys.filter(Boolean)));

  if (uniqueKeys.length === 0) return map;

  const { rows } = await pool.query(
    `
    SELECT
      rule_key,
      bonus,
      win_rate,
      sample_count,
      confidence
    FROM ai_power_weight_rules
    WHERE
      rule_type = 'pattern'
      AND is_active = true
      AND rule_key = ANY($1)
    `,
    [uniqueKeys]
  );

  for (const row of rows) {
    const ruleKey = String(row.rule_key);

    map.set(ruleKey, {
      ruleKey,
      bonus: Number(row.bonus || 0),
      winRate: Number(row.win_rate || 0),
      sampleCount: Number(row.sample_count || 0),
      confidence: Number(row.confidence || 0),
    });
  }

  return map;
}

async function getSectorWeightRuleMap(sectorKeys: string[]) {
  const map = new Map<string, SectorWeightRule>();
  const uniqueKeys = Array.from(new Set(sectorKeys.filter(Boolean)));

  if (uniqueKeys.length === 0) return map;

  const { rows } = await pool.query(
    `
    SELECT
      rule_key,
      bonus,
      win_rate,
      sample_count,
      confidence
    FROM ai_power_weight_rules
    WHERE
      rule_type = 'SECTOR'
      AND is_active = true
      AND rule_key = ANY($1)
    `,
    [uniqueKeys]
  );

  for (const row of rows) {
    const ruleKey = String(row.rule_key);

    map.set(ruleKey, {
      ruleKey,
      bonus: Number(row.bonus || 0),
      winRate: Number(row.win_rate || 0),
      sampleCount: Number(row.sample_count || 0),
      confidence: Number(row.confidence || 0),
    });
  }

  return map;
}

async function getSectorStatsMap(sectorKeys: string[]) {
  const map = new Map<string, SectorStats>();
  const uniqueKeys = Array.from(new Set(sectorKeys.filter(Boolean)));

  if (uniqueKeys.length === 0) return map;

  const { rows } = await pool.query(
    `
    SELECT
      sector_key,
      SUM(win_count) AS win,
      SUM(lose_count) AS lose
    FROM sector_learning_logs
    WHERE sector_key = ANY($1)
    GROUP BY sector_key
    `,
    [uniqueKeys]
  );

  for (const row of rows) {
    const sectorKey = String(row.sector_key);

    map.set(sectorKey, {
      sectorKey,
      win: Number(row.win || 0),
      lose: Number(row.lose || 0),
    });
  }

  return map;
}
async function fetchYahooChart(
  code: string
): Promise<(ChartAnalysis & { dataSource?: string }) | null> {
  const symbol = `${code}.T`;

  async function fetchChart(range: string, interval: string) {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
        symbol
      )}?range=${range}&interval=${interval}`,
      {
        cache: "no-store",
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
      }
    );

    if (!res.ok) return null;

    const data = await res.json();
    const result = data.chart?.result?.[0];

    if (!result) return null;

    const timestamps: number[] = result.timestamp ?? [];
    const quote = result.indicators?.quote?.[0];

    const candles = timestamps
      .map((time: number, index: number) => ({
        time,
        open: quote?.open?.[index],
        high: quote?.high?.[index],
        low: quote?.low?.[index],
        close: quote?.close?.[index],
        volume: quote?.volume?.[index],
      }))
      .filter((item: any) => item.close)
      .slice(-60);

    const closes = candles.map((candle: any) => candle.close);
    const currentPrice = closes[closes.length - 1] ?? null;

    if (!currentPrice) return null;

    return {
      candles,
      closes,
      currentPrice,
    };
  }

  let chartData = await fetchChart("1d", "5m");
  let dataSource = "intraday";

  if (!chartData) {
    chartData = await fetchChart("5d", "1d");
    dataSource = "daily_fallback";
  }

  if (!chartData) return null;

  const { candles, closes, currentPrice } = chartData;

  const ma20 =
    closes.length >= 20
      ? closes.slice(-20).reduce((sum: number, value: number) => {
          return sum + value;
        }, 0) / 20
      : null;

  const trend =
    ma20 === null || currentPrice === null
      ? "NO_DATA"
      : currentPrice > ma20
      ? "UPTREND"
      : "DOWNTREND";

  const prev = candles[candles.length - 2];
  const last = candles[candles.length - 1];

  let candleSignal = "NONE";
  let patternSignal = "NONE";
  let patternScore = 0;
  const patternReasons: string[] = [];

  if (prev && last) {
    const prevBear = prev.close < prev.open;
    const prevBull = prev.close > prev.open;
    const lastBear = last.close < last.open;
    const lastBull = last.close > last.open;

    const bullishEngulfing =
      prevBear &&
      lastBull &&
      last.open <= prev.close &&
      last.close >= prev.open;

    const bearishEngulfing =
      prevBull &&
      lastBear &&
      last.open >= prev.close &&
      last.close <= prev.open;

    if (bullishEngulfing) {
      candleSignal = "BULLISH_ENGULFING";
      patternScore += 15;
      patternReasons.push("買い包み足を検出");
    }

    if (bearishEngulfing) {
      candleSignal = "BEARISH_ENGULFING";
      patternScore -= 15;
      patternReasons.push("売り包み足を検出");
    }
  }

  if (trend === "UPTREND") {
    patternScore += 10;
    patternReasons.push("現在価格がMA20より上");
  }

  if (trend === "DOWNTREND") {
    patternScore -= 10;
    patternReasons.push("現在価格がMA20より下");
  }

  if (candles.length >= 20 && currentPrice !== null) {
    const recent = candles.slice(-20);
    const firstHalf = recent.slice(0, 10);
    const secondHalf = recent.slice(10, 20);

    const firstLow = Math.min(...firstHalf.map((c: any) => c.low));
    const secondLow = Math.min(...secondHalf.map((c: any) => c.low));

    const firstLowIndex = firstHalf.findIndex((c: any) => c.low === firstLow);
    const secondLowIndex =
      secondHalf.findIndex((c: any) => c.low === secondLow) + 10;

    const lowsClose = Math.abs(firstLow - secondLow) / currentPrice < 0.015;

    const middleHigh = Math.max(
      ...recent.slice(firstLowIndex, secondLowIndex).map((c: any) => c.high)
    );

    const necklineBreak = currentPrice > middleHigh * 0.998;
    const bouncedFromSecondLow = currentPrice > secondLow * 1.008;

    if (lowsClose && bouncedFromSecondLow) {
      patternSignal = "W_BOTTOM";
      patternScore += 25;
      patternReasons.push("Wボトム候補を検出");
    }

    if (lowsClose && bouncedFromSecondLow && necklineBreak) {
      patternSignal = "W_BOTTOM_BREAK";
      patternScore += 20;
      patternReasons.push("ネックライン付近まで回復");
    }
  }

  return {
    success: true,
    dataSource,
    currentPrice,
    ma20: ma20 === null ? null : Number(ma20.toFixed(2)),
    trend,
    candleSignal,
    patternSignal,
    patternScore,
    patternReasons,
    candles,
  };
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
        aiPowerVersion: "V13.4",
        learningBonusEnabled: true,
        patternBonusEnabled: true,
        weightRulesEnabled: true,
        sectorEnabled: true,
        sectorBonusEnabled: true,
        sectorWeightRuleEnabled: true,
        experienceBonusEnabled: true,
        similarExperienceEnabled: true,
        experienceRankingEnabled: true,
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

    const rawScored = await runInBatches(targetStocks, 20, async (stock) => {
      const chart = await fetchYahooChart(stock.code);

      if (!chart?.currentPrice) return null;

      const scored = calculateAiScore({
        code: stock.code,
        name: stock.name,
        price: chart.currentPrice,
        previousClose: chart.candles?.[0]?.open ?? null,
        chart,
      });

      return {
        ...scored,
        dataSource: chart.dataSource ?? "intraday",
      };
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

    const stocks = validScored
      .map((scored: any) => {
        const sectorKey = getSectorKey(scored.code);
        const sectorLabel = getSectorLabel(scored.code);

        const experienceKey = createExperienceKey({
          patternKey: scored.patternKey,
          sectorKey,
          marketPattern,
        });

        const learningStats = learningStatsMap.get(scored.code);
        const judgedLearning =
          (learningStats?.win ?? 0) + (learningStats?.lose ?? 0);

        const learning =
          judgedLearning > 0
            ? calculateLearningBonus(learningStats?.winRate)
            : {
                bonus: 0,
                winRate: 0,
              };

        const patternStats = patternStatsMap.get(scored.patternKey);
        const pattern = calculatePatternBonus({
          win: patternStats?.win ?? 0,
          lose: patternStats?.lose ?? 0,
        });

        const weightRule = weightRuleMap.get(scored.patternKey);
        const weightRuleApplied = Boolean(weightRule);

        const finalPatternBonus = weightRuleApplied
          ? weightRule!.bonus
          : pattern.bonus;

        const sectorStats = sectorStatsMap.get(sectorKey);
        const calculatedSector = calculateSectorBonus({
          win: sectorStats?.win ?? 0,
          lose: sectorStats?.lose ?? 0,
        });

        const sectorWeightRule = sectorWeightRuleMap.get(sectorKey);
        const sectorWeightRuleApplied = Boolean(sectorWeightRule);

        const finalSectorBonus = sectorWeightRuleApplied
          ? sectorWeightRule!.bonus
          : calculatedSector.bonus;
                  const experience =
          experienceBonusMap.get(experienceKey) || {
            bonus: 0,
            winRate: 0,
            total: 0,
            win: 0,
            lose: 0,
            confidence: 0,
          };

        const similarExperience =
          similarExperienceBonusMap.get(experienceKey) || {
            bonus: 0,
            baseBonus: 0,
            winRate: 0,
            total: 0,
            win: 0,
            lose: 0,
            confidence: 0,
            similarityRate: 0,
            similarCount: 0,
            averageSimilarity: 0,
            items: [],
          };

        const experienceRanking =
          experienceRankingMap.get(experienceKey) || {
            bonus: 0,
            winRate: 0,
            total: 0,
            win: 0,
            lose: 0,
            confidence: 0,
            weightedWinRate: 0,
            weightedTotal: 0,
            averageSimilarity: 0,
            topCount: 0,
            items: [],
          };

        const finalScore = clampScore(
          scored.score +
            learning.bonus +
            finalPatternBonus +
            finalSectorBonus +
            experience.bonus +
            similarExperience.bonus +
            experienceRanking.bonus
        );

        const learningReason =
          learningStats && learningStats.win + learningStats.lose > 0
            ? `AI学習補正${learning.bonus >= 0 ? "+" : ""}${learning.bonus}・銘柄勝率${learning.winRate}%`
            : "";

        const patternReason =
          weightRuleApplied
            ? `AI自己進化補正${finalPatternBonus >= 0 ? "+" : ""}${finalPatternBonus}・信頼度${weightRule!.confidence}%`
            : pattern.total >= 10
            ? `パターン補正${pattern.bonus >= 0 ? "+" : ""}${pattern.bonus}・パターン勝率${pattern.winRate}%`
            : "";

        const sectorReason =
          sectorWeightRuleApplied
            ? `セクターAI補正${finalSectorBonus >= 0 ? "+" : ""}${finalSectorBonus}・${sectorLabel}勝率${sectorWeightRule!.winRate}%`
            : calculatedSector.total >= 10
            ? `セクター補正${calculatedSector.bonus >= 0 ? "+" : ""}${calculatedSector.bonus}・${sectorLabel}勝率${calculatedSector.winRate}%`
            : "";

        const experienceReason =
          experience.total >= 10
            ? `経験補正${experience.bonus >= 0 ? "+" : ""}${experience.bonus}・経験勝率${experience.winRate}%`
            : "";

        const similarExperienceReason =
          similarExperience.total >= 10
            ? `類似経験補正${similarExperience.bonus >= 0 ? "+" : ""}${similarExperience.bonus}・類似勝率${similarExperience.winRate}%・平均類似${similarExperience.averageSimilarity}%`
            : "";

        const experienceRankingReason =
          experienceRanking.weightedTotal >= 10
            ? `経験ランキング補正${experienceRanking.bonus >= 0 ? "+" : ""}${experienceRanking.bonus}・重み付き勝率${experienceRanking.weightedWinRate}%・TOP${experienceRanking.topCount}`
            : "";

        const reasons = [
          scored.reason,
          learningReason,
          patternReason,
          sectorReason,
          experienceReason,
          similarExperienceReason,
          experienceRankingReason,
        ].filter(Boolean);

        return {
          ...scored,

          sectorKey,
          sectorLabel,

          experienceKey,
          marketPattern,

          score: finalScore,
          aiPower: finalScore,

          rank:
            finalScore >= 85
              ? "S"
              : finalScore >= 70
              ? "A"
              : finalScore >= 50
              ? "B"
              : "C",

          scoreBreakdown: {
            ...scored.scoreBreakdown,
            learning: learning.bonus,
            patternLearning: finalPatternBonus,
            sector: finalSectorBonus,
            experience: experience.bonus,
            similarExperience: similarExperience.bonus,
            experienceRanking: experienceRanking.bonus,
          },

          learningBonus: learning.bonus,
          learningWinRate: learning.winRate,
          learningWin: learningStats?.win ?? 0,
          learningLose: learningStats?.lose ?? 0,

          patternBonus: finalPatternBonus,
          patternBonusSource: weightRuleApplied
            ? "weight_rule"
            : "calculated",
                      patternWinRate: weightRuleApplied
            ? weightRule!.winRate
            : pattern.winRate,
          patternTotal: weightRuleApplied
            ? weightRule!.sampleCount
            : pattern.total,
          patternWin: pattern.win,
          patternLose: pattern.lose,

          sectorBonus: finalSectorBonus,
          sectorBonusSource: sectorWeightRuleApplied
            ? "sector_weight_rule"
            : "calculated",
          sectorWeightRuleApplied,
          sectorWeightRuleBonus: sectorWeightRule?.bonus ?? 0,
          sectorWeightRuleConfidence: sectorWeightRule?.confidence ?? 0,
          sectorWinRate: sectorWeightRuleApplied
            ? sectorWeightRule!.winRate
            : calculatedSector.winRate,
          sectorTotal: sectorWeightRuleApplied
            ? sectorWeightRule!.sampleCount
            : calculatedSector.total,
          sectorWin: sectorStats?.win ?? 0,
          sectorLose: sectorStats?.lose ?? 0,

          experienceBonus: experience.bonus,
          experienceWinRate: experience.winRate,
          experienceTotal: experience.total,
          experienceWin: experience.win,
          experienceLose: experience.lose,
          experienceConfidence: experience.confidence,

          similarExperienceBonus: similarExperience.bonus,
          similarExperienceBaseBonus: similarExperience.baseBonus,
          similarExperienceWinRate: similarExperience.winRate,
          similarExperienceTotal: similarExperience.total,
          similarExperienceWin: similarExperience.win,
          similarExperienceLose: similarExperience.lose,
          similarExperienceConfidence: similarExperience.confidence,
          similarExperienceCount: similarExperience.similarCount,
          similarExperienceSimilarityRate: similarExperience.similarityRate,
          averageSimilarity: similarExperience.averageSimilarity,

          experienceRankingBonus: experienceRanking.bonus,
          experienceRankingWinRate: experienceRanking.winRate,
          experienceRankingWeightedWinRate: experienceRanking.weightedWinRate,
          experienceRankingTotal: experienceRanking.total,
          experienceRankingWeightedTotal: experienceRanking.weightedTotal,
          experienceRankingWin: experienceRanking.win,
          experienceRankingLose: experienceRanking.lose,
          experienceRankingConfidence: experienceRanking.confidence,
          experienceRankingAverageSimilarity:
            experienceRanking.averageSimilarity,
          experienceRankingTopCount: experienceRanking.topCount,
          experienceRankingItems: experienceRanking.items,

          weightRuleApplied,
          weightRuleBonus: weightRule?.bonus ?? 0,
          weightRuleConfidence: weightRule?.confidence ?? 0,

          reason: reasons.join("・"),
        };
      })
      .sort((a: any, b: any) => b.score - a.score);

    cacheData = {
      timestamp: Date.now(),
      limit,
      stocks,
    };

    return NextResponse.json({
      success: true,
      cached: false,
      debugVersion: DEBUG_VERSION,
      aiPowerVersion: "V13.4",
      learningBonusEnabled: true,
      patternBonusEnabled: true,
      weightRulesEnabled: true,
      sectorEnabled: true,
      sectorBonusEnabled: true,
      sectorWeightRuleEnabled: true,
      experienceBonusEnabled: true,
      similarExperienceEnabled: true,
      experienceRankingEnabled: true,
      marketPattern,
      count: stocks.length,
      requestedLimit: limit,
      totalStockList: uniqueStocks.length,
      scanMs: Date.now() - startedAt,
      batchSize: 20,
      stocks,
    });
  } catch (error) {
    if (cacheData) {
      return NextResponse.json({
        success: true,
        cached: true,
        fallback: true,
        debugVersion: DEBUG_VERSION,
        aiPowerVersion: "V13.4",
        learningBonusEnabled: true,
        patternBonusEnabled: true,
        weightRulesEnabled: true,
        sectorEnabled: true,
        sectorBonusEnabled: true,
        sectorWeightRuleEnabled: true,
        experienceBonusEnabled: true,
        similarExperienceEnabled: true,
        experienceRankingEnabled: true,
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
        stocks: [],
        error: String(error),
      },
      { status: 500 }
    );
  }
}