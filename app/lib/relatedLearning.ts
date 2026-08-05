import pool from "@/app/lib/postgres";
import { createExperienceKey } from "@/app/lib/experienceLearning";
import { summarizeMarketLearning } from "@/app/lib/marketLearning";
import { getSectorKey } from "@/app/lib/sectorMap";
import { summarizeSectors } from "@/app/lib/sectorLearning";

export type RelatedLearningStock = {
  code: string;
  name?: string;
  score?: number;
  aiPower?: number;
  price?: number;
  changePercent?: number;
  result?: string;
  patternKey?: string;
  patternLearning?: {
    rsiBand?: string;
    trendKey?: string;
    ema20Key?: string;
    vwapKey?: string;
    macdKey?: string;
  };
};

function assertTradeDate(tradeDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tradeDate)) {
    throw new Error(`Invalid trade date: ${tradeDate}`);
  }
}

function getSeasonInfo(tradeDate: string) {
  const date = new Date(`${tradeDate}T00:00:00`);
  const tradeDay = date.getDate();
  const monthPhase =
    tradeDay <= 10
      ? "EARLY_MONTH"
      : tradeDay >= 21
        ? "LATE_MONTH"
        : "MID_MONTH";

  return {
    tradeYear: date.getFullYear(),
    tradeMonth: date.getMonth() + 1,
    tradeDay,
    weekday: date.getDay(),
    monthPhase,
    seasonKey: `${date.getMonth() + 1}_${monthPhase}`,
  };
}

export async function saveRelatedLearning(
  tradeDate: string,
  stocks: RelatedLearningStock[],
) {
  assertTradeDate(tradeDate);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      [`signalx-related-learning:${tradeDate}`],
    );

    await client.query(
      "DELETE FROM pattern_learning_logs WHERE trade_date = $1",
      [tradeDate],
    );
    await client.query(
      "DELETE FROM experience_learning_logs WHERE trade_date = $1",
      [tradeDate],
    );

    const patternTargets = stocks.filter(
      (stock) =>
        stock.code &&
        stock.name &&
        stock.patternKey &&
        stock.patternLearning &&
        typeof (stock.aiPower ?? stock.score) === "number" &&
        typeof stock.price === "number",
    );

    if (patternTargets.length > 0) {
      const values: unknown[] = [];
      const placeholders = patternTargets.map((stock, index) => {
        const base = index * 11;
        const pattern = stock.patternLearning!;
        values.push(
          tradeDate,
          stock.code,
          stock.name,
          stock.patternKey,
          pattern.rsiBand ?? null,
          pattern.macdKey ?? null,
          pattern.vwapKey ?? null,
          pattern.ema20Key ?? null,
          pattern.trendKey ?? null,
          stock.aiPower ?? stock.score,
          stock.price,
        );
        return `(${Array.from({ length: 11 }, (_, offset) => `$${base + offset + 1}`).join(", ")})`;
      });

      await client.query(
        `INSERT INTO pattern_learning_logs (
          trade_date, code, name, pattern_key, rsi_band, macd_key,
          vwap_key, ema20_key, trend_key, ai_power, entry_price
        ) VALUES ${placeholders.join(", ")}`,
        values,
      );
    }

    const sectorSummaries = summarizeSectors(stocks);
    for (const item of sectorSummaries) {
      await client.query(
        `INSERT INTO sector_learning_logs (
          trade_date, sector_key, sector_name, total_count, win_count,
          lose_count, hold_count, judged_count, win_rate, ai_bonus,
          confidence, average_ai_power, average_change
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (trade_date, sector_key) DO UPDATE SET
          sector_name = EXCLUDED.sector_name,
          total_count = EXCLUDED.total_count,
          win_count = EXCLUDED.win_count,
          lose_count = EXCLUDED.lose_count,
          hold_count = EXCLUDED.hold_count,
          judged_count = EXCLUDED.judged_count,
          win_rate = EXCLUDED.win_rate,
          ai_bonus = EXCLUDED.ai_bonus,
          confidence = EXCLUDED.confidence,
          average_ai_power = EXCLUDED.average_ai_power,
          average_change = EXCLUDED.average_change`,
        [
          tradeDate,
          item.sectorKey,
          item.sectorName,
          item.totalCount,
          item.winCount,
          item.loseCount,
          item.holdCount,
          item.judgedCount,
          item.winRate,
          item.aiBonus,
          item.confidence,
          item.averageAiPower,
          item.averageChange,
        ],
      );
    }

    await client.query(
      `DELETE FROM sector_learning_logs
       WHERE trade_date = $1
         AND NOT (sector_key = ANY($2::text[]))`,
      [tradeDate, sectorSummaries.map((item) => item.sectorKey)],
    );

    const market = summarizeMarketLearning({ tradeDate, stocks });
    await client.query(
      `INSERT INTO market_learning_logs (
        trade_date, nikkei, topix, usd_jpy, vix, market_trend,
        market_score, market_comment, market_pattern, total_count,
        win_count, lose_count, hold_count, judged_count, win_rate,
        ai_bonus, confidence
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      ON CONFLICT (trade_date) DO UPDATE SET
        nikkei = EXCLUDED.nikkei,
        topix = EXCLUDED.topix,
        usd_jpy = EXCLUDED.usd_jpy,
        vix = EXCLUDED.vix,
        market_trend = EXCLUDED.market_trend,
        market_score = EXCLUDED.market_score,
        market_comment = EXCLUDED.market_comment,
        market_pattern = EXCLUDED.market_pattern,
        total_count = EXCLUDED.total_count,
        win_count = EXCLUDED.win_count,
        lose_count = EXCLUDED.lose_count,
        hold_count = EXCLUDED.hold_count,
        judged_count = EXCLUDED.judged_count,
        win_rate = EXCLUDED.win_rate,
        ai_bonus = EXCLUDED.ai_bonus,
        confidence = EXCLUDED.confidence`,
      [
        market.tradeDate,
        market.nikkei,
        market.topix,
        market.usdJpy,
        market.vix,
        market.marketTrend,
        market.marketScore,
        market.marketComment,
        market.marketPattern,
        market.totalCount,
        market.winCount,
        market.loseCount,
        market.holdCount,
        market.judgedCount,
        market.winRate,
        market.aiBonus,
        market.confidence,
      ],
    );

    const experienceTargets = stocks.filter(
      (stock) => stock.code && stock.patternKey,
    );
    const season = getSeasonInfo(tradeDate);

    if (experienceTargets.length > 0) {
      const values: unknown[] = [];
      const placeholders = experienceTargets.map((stock, index) => {
        const base = index * 14;
        const sectorKey = getSectorKey(stock.code);
        values.push(
          createExperienceKey({
            patternKey: stock.patternKey,
            sectorKey,
            marketPattern: market.marketPattern,
          }),
          tradeDate,
          stock.code,
          stock.patternKey,
          sectorKey,
          market.marketPattern,
          stock.result ?? "UNKNOWN",
          stock.aiPower ?? stock.score ?? null,
          season.tradeYear,
          season.tradeMonth,
          season.tradeDay,
          season.weekday,
          season.monthPhase,
          season.seasonKey,
        );
        return `(${Array.from({ length: 14 }, (_, offset) => `$${base + offset + 1}`).join(", ")})`;
      });

      await client.query(
        `INSERT INTO experience_learning_logs (
          experience_key, trade_date, code, pattern_key, sector_key,
          market_pattern, result, ai_power, trade_year, trade_month,
          trade_day, weekday, month_phase, season_key
        ) VALUES ${placeholders.join(", ")}`,
        values,
      );
    }

    await client.query("COMMIT");

    return {
      patternAdded: patternTargets.length,
      sectorAdded: sectorSummaries.length,
      marketAdded: 1,
      experienceAdded: experienceTargets.length,
      market,
      season,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
