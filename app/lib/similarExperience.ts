import pool from "@/app/lib/postgres";
import { calculateExperienceBonus } from "@/app/lib/experienceBonus";

export type SimilarExperienceItem = {
  experienceKey: string;
  win: number;
  lose: number;
  total: number;
  matchCount: number;
  similarity: number;
};

export type SimilarExperienceResult = {
  bonus: number;
  baseBonus: number;
  winRate: number;
  total: number;
  win: number;
  lose: number;
  confidence: number;
  similarityRate: number;
  similarCount: number;
  averageSimilarity: number;
  items: SimilarExperienceItem[];
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

function getSimilarityRate(averageSimilarity: number) {
  if (averageSimilarity >= 90) return 1;
  if (averageSimilarity >= 80) return 0.8;
  if (averageSimilarity >= 70) return 0.5;
  return 0;
}

function applySimilaritySafety(baseBonus: number, averageSimilarity: number) {
  const similarityRate = getSimilarityRate(averageSimilarity);

  return {
    bonus: Math.round(baseBonus * similarityRate),
    similarityRate,
  };
}

function emptyResult(): SimilarExperienceResult {
  return {
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
}

export async function getSimilarExperienceBonus(
  experienceKey: string,
  options?: {
    minSimilarity?: number;
    limit?: number;
  }
): Promise<SimilarExperienceResult> {
  const minSimilarity = options?.minSimilarity ?? 70;
  const limit = options?.limit ?? 300;

  const targetParts = splitExperienceKey(experienceKey);

  if (targetParts.length === 0) {
    return emptyResult();
  }

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
    [
      targetParts[0] ?? null,
      targetParts[targetParts.length - 2] ?? null,
      targetParts[targetParts.length - 1] ?? null,
      limit,
    ]
  );

  const items: SimilarExperienceItem[] = rows
    .map((row) => {
      const key = String(row.experience_key);
      const win = Number(row.win || 0);
      const lose = Number(row.lose || 0);
      const { matchCount, similarity } = calculateSimilarity(
        experienceKey,
        key
      );

      return {
        experienceKey: key,
        win,
        lose,
        total: win + lose,
        matchCount,
        similarity,
      };
    })
    .filter((item) => item.total > 0 && item.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity || b.total - a.total);

  const win = items.reduce((sum, item) => sum + item.win, 0);
  const lose = items.reduce((sum, item) => sum + item.lose, 0);

  const base = calculateExperienceBonus({
    win,
    lose,
  });

  const averageSimilarity =
    items.length === 0
      ? 0
      : Math.round(
          items.reduce((sum, item) => sum + item.similarity, 0) / items.length
        );

  const safety = applySimilaritySafety(base.bonus, averageSimilarity);

  return {
    bonus: safety.bonus,
    baseBonus: base.bonus,
    winRate: base.winRate,
    total: base.total,
    win: base.win,
    lose: base.lose,
    confidence: base.confidence,
    similarityRate: safety.similarityRate,
    similarCount: items.length,
    averageSimilarity,
    items: items.slice(0, 20),
  };
}

export async function getSimilarExperienceBonusMap(
  experienceKeys: string[],
  options?: {
    minSimilarity?: number;
    limit?: number;
  }
) {
  const map = new Map<string, SimilarExperienceResult>();
  const uniqueKeys = Array.from(new Set(experienceKeys.filter(Boolean)));

  for (const key of uniqueKeys) {
    const result = await getSimilarExperienceBonus(key, options);
    map.set(key, result);
  }

  return map;
}