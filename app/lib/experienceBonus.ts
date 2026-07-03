import pool from "@/app/lib/postgres";

export type ExperienceBonusResult = {
  bonus: number;
  winRate: number;
  total: number;
  win: number;
  lose: number;
  confidence: number;
};

export type ExperienceProfile = {
  experienceKey?: string | null;
  patternKey?: string | null;
  sectorKey?: string | null;
  marketPattern?: string | null;
  trend?: string | null;
  rsiZone?: string | null;
  macdState?: string | null;
  ema20State?: string | null;
  vwapState?: string | null;
};

export type SimilarExperienceBonusResult = ExperienceBonusResult & {
  similarity: number;
  matched: number;
  checked: number;
};

function calculateConfidence(total: number) {
  if (total >= 100) return 100;
  if (total >= 30) return 80;
  if (total >= 10) return 50;
  return 0;
}

function calculateBonus(winRate: number, total: number) {
  if (total < 10) return 0;

  if (winRate >= 85) return 10;
  if (winRate >= 75) return 8;
  if (winRate >= 65) return 5;
  if (winRate >= 55) return 2;
  if (winRate >= 45) return 0;
  if (winRate >= 35) return -3;
  if (winRate >= 25) return -6;

  return -10;
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
      confidence: 0,
    };
  }

  const winRate = Math.round((win / total) * 100);
  const confidence = calculateConfidence(total);
  const bonus = calculateBonus(winRate, total);

  return {
    bonus,
    winRate,
    total,
    win,
    lose,
    confidence,
  };
}

function calculateSimilarity(
  current: ExperienceProfile,
  history: ExperienceProfile
) {
  const checks = [
    
    [current.sectorKey, history.sectorKey],
    [current.marketPattern, history.marketPattern],
    [current.trend, history.trend],
    [current.rsiZone, history.rsiZone],
    [current.macdState, history.macdState],
    [current.ema20State, history.ema20State],
    [current.vwapState, history.vwapState],
  ];

  const validChecks = checks.filter(([a, b]) => Boolean(a) && Boolean(b));
  const checked = validChecks.length;

  if (checked === 0) {
    return {
      similarity: 0,
      matched: 0,
      checked: 0,
    };
  }

  const matched = validChecks.filter(([a, b]) => a === b).length;
  const similarity = Math.round((matched / checked) * 100);

  return {
    similarity,
    matched,
    checked,
  };
}

export async function getExperienceBonusMap(experienceKeys: string[]) {
  const map = new Map<string, ExperienceBonusResult>();

  const uniqueKeys = Array.from(new Set(experienceKeys.filter(Boolean)));

  if (uniqueKeys.length === 0) {
    return map;
  }

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

export async function getSimilarExperienceBonus(
  current: ExperienceProfile,
  options?: {
    minSimilarity?: number;
    limit?: number;
  }
): Promise<SimilarExperienceBonusResult> {
  const minSimilarity = options?.minSimilarity ?? 80;
  const limit = options?.limit ?? 5000;

  const { rows } = await pool.query(
    `
    SELECT
      pattern_key,
      sector_key,
      market_pattern,
      trend,
      rsi_zone,
      macd_state,
      ema20_state,
      vwap_state,
      result
    FROM experience_learning_logs
    WHERE result IN ('WIN', 'LOSE')
    ORDER BY id DESC
    LIMIT $1
    `,
    [limit]
  );

  let win = 0;
  let lose = 0;
  let similarityTotal = 0;
  let matchedTotal = 0;
  let checkedTotal = 0;

  for (const row of rows) {
    const similarity = calculateSimilarity(current, {
      patternKey: row.pattern_key,
      sectorKey: row.sector_key,
      marketPattern: row.market_pattern,
      trend: row.trend,
      rsiZone: row.rsi_zone,
      macdState: row.macd_state,
      ema20State: row.ema20_state,
      vwapState: row.vwap_state,
    });

    if (similarity.similarity < minSimilarity) continue;

    similarityTotal += similarity.similarity;
    matchedTotal += similarity.matched;
    checkedTotal += similarity.checked;

    if (row.result === "WIN") win++;
    if (row.result === "LOSE") lose++;
  }

  const base = calculateExperienceBonus({ win, lose });
  const total = win + lose;

  return {
    ...base,
    similarity: total > 0 ? Math.round(similarityTotal / total) : 0,
    matched: matchedTotal,
    checked: checkedTotal,
  };
}