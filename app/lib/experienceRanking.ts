import pool from "@/app/lib/postgres";

export type ExperienceRankingItem = {
  experienceKey: string;
  win: number;
  lose: number;
  total: number;
  matchCount: number;
  similarity: number;
  weight: number;
  weightedWin: number;
  weightedLose: number;
};

export type ExperienceRankingResult = {
  bonus: number;
  winRate: number;
  total: number;
  win: number;
  lose: number;
  confidence: number;
  weightedWinRate: number;
  weightedTotal: number;
  averageSimilarity: number;
  topCount: number;
  items: ExperienceRankingItem[];
};

function splitExperienceKey(key: string) {
  return String(key || "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
}

function calculateSimilarity(targetKey: string, candidateKey: string) {
  const targetParts = splitExperienceKey(targetKey);
  const candidateParts = splitExperienceKey(candidateKey);

  if (targetParts.length === 0 || candidateParts.length === 0) {
    return {
      matchCount: 0,
      similarity: 0,
    };
  }

  const maxLength = Math.max(targetParts.length, candidateParts.length);
  let matchCount = 0;

  for (let i = 0; i < maxLength; i += 1) {
    if (targetParts[i] && targetParts[i] === candidateParts[i]) {
      matchCount += 1;
    }
  }

  return {
    matchCount,
    similarity: Math.round((matchCount / maxLength) * 100),
  };
}

function getSimilarityWeight(similarity: number) {
  if (similarity >= 100) return 1;
  if (similarity >= 95) return 0.9;
  if (similarity >= 90) return 0.8;
  if (similarity >= 80) return 0.6;
  if (similarity >= 70) return 0.4;
  return 0;
}

function calculateConfidence(total: number) {
  if (total >= 100) return 100;
  if (total >= 30) return 80;
  if (total >= 10) return 50;
  return 0;
}
function calculateBonus(winRate: number, total: number) {
  // データ量による信頼度スケール
  let scale = 0;

  if (total >= 30) scale = 1.0;
  else if (total >= 20) scale = 0.8;
  else if (total >= 10) scale = 0.6;
  else if (total >= 5) scale = 0.3;
  else if (total >= 3) scale = 0.1;
  else return 0;

  let baseBonus = 0;

  if (winRate >= 85) baseBonus = 10;
  else if (winRate >= 75) baseBonus = 8;
  else if (winRate >= 65) baseBonus = 5;
  else if (winRate >= 55) baseBonus = 2;
  else if (winRate >= 45) baseBonus = 0;
  else if (winRate >= 35) baseBonus = -3;
  else if (winRate >= 25) baseBonus = -6;
  else baseBonus = -10;

  return Math.round(baseBonus * scale);
}

function emptyResult(): ExperienceRankingResult {
  return {
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
}

export async function getExperienceRanking(
  experienceKey: string,
  options?: {
    minSimilarity?: number;
    candidateLimit?: number;
    topLimit?: number;
  }
): Promise<ExperienceRankingResult> {
  const minSimilarity = options?.minSimilarity ?? 70;
  const candidateLimit = options?.candidateLimit ?? 500;
  const topLimit = options?.topLimit ?? 10;

  const targetParts = splitExperienceKey(experienceKey);

  if (targetParts.length === 0) {
    return emptyResult();
  }

  const patternKey = targetParts[0] ?? null;
  const sectorKey = targetParts[targetParts.length - 2] ?? null;
  const marketPattern = targetParts[targetParts.length - 1] ?? null;

  const { rows } = await pool.query(
    `
    SELECT
      experience_key,
      SUM(CASE WHEN result = 'WIN' THEN 1 ELSE 0 END)::int AS win,
      SUM(CASE WHEN result = 'LOSE' THEN 1 ELSE 0 END)::int AS lose,
      COUNT(*)::int AS raw_total
    FROM experience_learning_logs
    WHERE result IN ('WIN', 'LOSE')
      AND (
        pattern_key = $1
        OR sector_key = $2
        OR market_pattern = $3
      )
    GROUP BY experience_key
    ORDER BY raw_total DESC
    LIMIT $4
    `,
    [patternKey, sectorKey, marketPattern, candidateLimit]
  );

  const rankedItems: ExperienceRankingItem[] = rows
    .map((row) => {
      const key = String(row.experience_key);
      const win = Number(row.win || 0);
      const lose = Number(row.lose || 0);
      const total = win + lose;

      const { matchCount, similarity } = calculateSimilarity(
        experienceKey,
        key
      );

      const weight = getSimilarityWeight(similarity);

      return {
        experienceKey: key,
        win,
        lose,
        total,
        matchCount,
        similarity,
        weight,
        weightedWin: Number((win * weight).toFixed(2)),
        weightedLose: Number((lose * weight).toFixed(2)),
      };
    })
    .filter(
      (item) =>
        item.total > 0 &&
        item.similarity >= minSimilarity &&
        item.weight > 0
    )
    .sort((a, b) => {
      if (b.similarity !== a.similarity) {
        return b.similarity - a.similarity;
      }

      return b.total - a.total;
    })
    .slice(0, topLimit);

  if (rankedItems.length === 0) {
    return emptyResult();
  }

  const win = rankedItems.reduce((sum, item) => sum + item.win, 0);
  const lose = rankedItems.reduce((sum, item) => sum + item.lose, 0);
  const total = win + lose;

  const weightedWin = rankedItems.reduce(
    (sum, item) => sum + item.weightedWin,
    0
  );

  const weightedLose = rankedItems.reduce(
    (sum, item) => sum + item.weightedLose,
    0
  );

  const weightedTotal = Number((weightedWin + weightedLose).toFixed(2));

  const winRate = total === 0 ? 0 : Math.round((win / total) * 100);

  const weightedWinRate =
    weightedTotal === 0
      ? 0
      : Math.round((weightedWin / weightedTotal) * 100);

  const averageSimilarity = Math.round(
    rankedItems.reduce((sum, item) => sum + item.similarity, 0) /
      rankedItems.length
  );

  return {
    bonus: calculateBonus(weightedWinRate, total),
    winRate,
    total,
    win,
    lose,
    confidence: calculateConfidence(total),
    weightedWinRate,
    weightedTotal,
    averageSimilarity,
    topCount: rankedItems.length,
    items: rankedItems,
  };
}

export async function getExperienceRankingMap(
  experienceKeys: string[],
  options?: {
    minSimilarity?: number;
    candidateLimit?: number;
    topLimit?: number;
  }
) {
  const map = new Map<string, ExperienceRankingResult>();
  const uniqueKeys = Array.from(new Set(experienceKeys.filter(Boolean)));

  for (const key of uniqueKeys) {
    const result = await getExperienceRanking(key, options);
    map.set(key, result);
  }

  return map;
}