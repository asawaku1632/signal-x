import pool from "@/app/lib/postgres";
import { getSectorKey } from "@/app/lib/sectorMap";

type StockExperience = {
  code: string;
  result?: string;
  aiPower?: number;
  score?: number;
  patternKey?: string;

  trend?: string | null;
  rsi?: number | null;
  macd?: number | null;
  macdSignal?: number | null;
  ema20?: number | null;
  vwap?: number | null;
  price?: number | null;
  currentPrice?: number | null;
  candleSignal?: string | null;
};

type SaveExperienceInput = {
  tradeDate: string;
  stocks: StockExperience[];
  marketPattern?: string | null;
};

export type ExperienceBonusResult = {
  bonus: number;
  winRate: number;
  total: number;
  win: number;
  lose: number;
};

function getRsiZone(rsi?: number | null) {
  if (rsi == null) return "NO_RSI";
  if (rsi < 30) return "RSI_UNDER_30";
  if (rsi < 40) return "RSI_30_40";
  if (rsi < 50) return "RSI_40_50";
  if (rsi < 60) return "RSI_50_60";
  if (rsi < 70) return "RSI_60_70";
  if (rsi < 80) return "RSI_70_80";
  return "RSI_OVER_80";
}

function getMacdState(macd?: number | null, macdSignal?: number | null) {
  if (macd == null || macdSignal == null) return "NO_MACD";
  if (macd > macdSignal) return "MACD_ABOVE_SIGNAL";
  if (macd < macdSignal) return "MACD_BELOW_SIGNAL";
  return "MACD_FLAT";
}

function getPrice(stock: StockExperience) {
  return stock.price ?? stock.currentPrice ?? null;
}

function getEma20State(stock: StockExperience) {
  const price = getPrice(stock);
  if (price == null || stock.ema20 == null) return "NO_EMA20";
  if (price > stock.ema20) return "PRICE_ABOVE_EMA20";
  if (price < stock.ema20) return "PRICE_BELOW_EMA20";
  return "PRICE_ON_EMA20";
}

function getVwapState(stock: StockExperience) {
  const price = getPrice(stock);
  if (price == null || stock.vwap == null) return "NO_VWAP";
  if (price > stock.vwap) return "PRICE_ABOVE_VWAP";
  if (price < stock.vwap) return "PRICE_BELOW_VWAP";
  return "PRICE_ON_VWAP";
}

export function createExperienceKey({
  patternKey,
  sectorKey,
  marketPattern,
}: {
  patternKey?: string | null;
  sectorKey?: string | null;
  marketPattern?: string | null;
}) {
  return [
    patternKey || "NO_PATTERN",
    sectorKey || "OTHER",
    marketPattern || "NO_MARKET",
  ].join("|");
}

export function calculateExperienceBonus({
  win,
  lose,
}: {
  win: number;
  lose: number;
}): ExperienceBonusResult {
  const total = win + lose;

  if (total <= 0) {
    return { bonus: 0, winRate: 0, total, win, lose };
  }

  const winRate = Math.round((win / total) * 100);

  if (total < 10) {
    return { bonus: 0, winRate, total, win, lose };
  }

  if (winRate >= 85) return { bonus: 10, winRate, total, win, lose };
  if (winRate >= 75) return { bonus: 8, winRate, total, win, lose };
  if (winRate >= 65) return { bonus: 5, winRate, total, win, lose };
  if (winRate >= 55) return { bonus: 2, winRate, total, win, lose };
  if (winRate >= 45) return { bonus: 0, winRate, total, win, lose };
  if (winRate >= 35) return { bonus: -3, winRate, total, win, lose };
  if (winRate >= 25) return { bonus: -6, winRate, total, win, lose };

  return { bonus: -10, winRate, total, win, lose };
}

export async function saveExperienceLearning({
  tradeDate,
  stocks,
  marketPattern,
}: SaveExperienceInput) {
  const targets = stocks.filter((stock) => stock.code && stock.patternKey);

  if (targets.length === 0) {
    return { experienceAdded: 0 };
  }

  const values: any[] = [];
  const placeholders: string[] = [];

  targets.forEach((stock, index) => {
    const sectorKey = getSectorKey(stock.code);

    const experienceKey = createExperienceKey({
      patternKey: stock.patternKey,
      sectorKey,
      marketPattern,
    });

    const trend = stock.trend ?? "NO_TREND";
    const rsiZone = getRsiZone(stock.rsi);
    const macdState = getMacdState(stock.macd, stock.macdSignal);
    const ema20State = getEma20State(stock);
    const vwapState = getVwapState(stock);
    const candleSignal = stock.candleSignal ?? "NONE";

    const base = index * 14;

    values.push(
      experienceKey,
      tradeDate,
      stock.code,
      stock.patternKey,
      sectorKey,
      marketPattern ?? null,
      trend,
      rsiZone,
      macdState,
      ema20State,
      vwapState,
      candleSignal,
      stock.result ?? "UNKNOWN",
      stock.aiPower ?? stock.score ?? null
    );

    placeholders.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${
        base + 5
      }, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${
        base + 10
      }, $${base + 11}, $${base + 12}, $${base + 13}, $${base + 14})`
    );
  });

  await pool.query(
    `
    INSERT INTO experience_learning_logs (
      experience_key,
      trade_date,
      code,
      pattern_key,
      sector_key,
      market_pattern,
      trend,
      rsi_zone,
      macd_state,
      ema20_state,
      vwap_state,
      candle_signal,
      result,
      ai_power
    )
    VALUES ${placeholders.join(",")}
    `,
    values
  );

  return {
    experienceAdded: targets.length,
  };
}

export async function getExperienceBonusMap(experienceKeys: string[]) {
  const map = new Map<string, ExperienceBonusResult>();

  const uniqueKeys = Array.from(new Set(experienceKeys.filter(Boolean)));

  if (uniqueKeys.length === 0) return map;

  const { rows } = await pool.query(
    `
    SELECT
      experience_key,
      SUM(CASE WHEN result = 'WIN' THEN 1 ELSE 0 END)::int AS win,
      SUM(CASE WHEN result = 'LOSE' THEN 1 ELSE 0 END)::int AS lose
    FROM experience_learning_logs
    WHERE experience_key = ANY($1)
    GROUP BY experience_key
    `,
    [uniqueKeys]
  );

  for (const row of rows) {
    const experienceKey = String(row.experience_key);
    const win = Number(row.win || 0);
    const lose = Number(row.lose || 0);

    map.set(
      experienceKey,
      calculateExperienceBonus({
        win,
        lose,
      })
    );
  }

  return map;
}