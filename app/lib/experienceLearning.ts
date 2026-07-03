import pool from "@/app/lib/postgres";
import { getSectorKey } from "@/app/lib/sectorMap";

type StockExperience = {
  code: string;
  result?: string;
  aiPower?: number;
  score?: number;
  patternKey?: string;
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

type SeasonInfo = {
  tradeYear: number;
  tradeMonth: number;
  tradeDay: number;
  weekday: number;
  monthPhase: string;
  seasonKey: string;
};

function getSeasonInfo(tradeDate: string): SeasonInfo {
  const date = new Date(`${tradeDate}T00:00:00`);
  const tradeYear = date.getFullYear();
  const tradeMonth = date.getMonth() + 1;
  const tradeDay = date.getDate();
  const weekday = date.getDay();

  let monthPhase = "MID_MONTH";

  if (tradeDay <= 10) {
    monthPhase = "EARLY_MONTH";
  } else if (tradeDay >= 21) {
    monthPhase = "LATE_MONTH";
  }

  const seasonKey = `${tradeMonth}_${monthPhase}`;

  return {
    tradeYear,
    tradeMonth,
    tradeDay,
    weekday,
    monthPhase,
    seasonKey,
  };
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
    return {
      bonus: 0,
      winRate: 0,
      total,
      win,
      lose,
    };
  }

  const winRate = Math.round((win / total) * 100);

  if (total < 10) {
    return {
      bonus: 0,
      winRate,
      total,
      win,
      lose,
    };
  }

  if (winRate >= 85) return { bonus: 10, winRate, total, win, lose };
  if (winRate >= 75) return { bonus: 8, winRate, total, win, lose };
  if (winRate >= 65) return { bonus: 5, winRate, total, win, lose };
  if (winRate >= 55) return { bonus: 2, winRate, total, win, lose };
  if (winRate >= 45) return { bonus: 0, winRate, total, win, lose };
  if (winRate >= 35) return { bonus: -3, winRate, total, win, lose };
  if (winRate >= 25) return { bonus: -6, winRate, total, win, lose };

  return {
    bonus: -10,
    winRate,
    total,
    win,
    lose,
  };
}

export async function saveExperienceLearning({
  tradeDate,
  stocks,
  marketPattern,
}: SaveExperienceInput) {
  const targets = stocks.filter((stock) => stock.code && stock.patternKey);

  if (targets.length === 0) {
    return {
      experienceAdded: 0,
    };
  }

  const season = getSeasonInfo(tradeDate);

  const values: any[] = [];
  const placeholders: string[] = [];

  targets.forEach((stock, index) => {
    const sectorKey = getSectorKey(stock.code);
    const experienceKey = createExperienceKey({
      patternKey: stock.patternKey,
      sectorKey,
      marketPattern,
    });

    const base = index * 14;

    values.push(
      experienceKey,
      tradeDate,
      stock.code,
      stock.patternKey,
      sectorKey,
      marketPattern ?? null,
      stock.result ?? "UNKNOWN",
      stock.aiPower ?? stock.score ?? null,
      season.tradeYear,
      season.tradeMonth,
      season.tradeDay,
      season.weekday,
      season.monthPhase,
      season.seasonKey
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
      result,
      ai_power,
      trade_year,
      trade_month,
      trade_day,
      weekday,
      month_phase,
      season_key
    )
    VALUES ${placeholders.join(",")}
    `,
    values
  );

  return {
    experienceAdded: targets.length,
    season,
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