import pool from "@/app/lib/postgres";

export type ExperienceBonusResult = {
  bonus: number;
  winRate: number;
  total: number;
  win: number;
  lose: number;
  confidence: number;
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