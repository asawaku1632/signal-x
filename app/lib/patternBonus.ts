export type PatternBonusInput = {
  win: number;
  lose: number;
};

export type PatternBonusResult = {
  bonus: number;
  baseBonus: number;
  confidenceRate: number;
  winRate: number;
  total: number;
  win: number;
  lose: number;
};

function getBaseBonus(winRate: number) {
  if (winRate >= 85) return 10;
  if (winRate >= 75) return 8;
  if (winRate >= 65) return 5;
  if (winRate >= 55) return 2;
  if (winRate >= 45) return 0;
  if (winRate >= 35) return -3;
  if (winRate >= 25) return -6;
  return -10;
}

function getConfidenceRate(total: number) {
  if (total < 10) return 0;
  if (total < 30) return 0.5;
  if (total < 100) return 0.8;
  return 1;
}

export function calculatePatternBonus({
  win,
  lose,
}: PatternBonusInput): PatternBonusResult {
  const total = win + lose;

  if (total <= 0) {
    return {
      bonus: 0,
      baseBonus: 0,
      confidenceRate: 0,
      winRate: 0,
      total,
      win,
      lose,
    };
  }

  const winRate = Math.round((win / total) * 100);
  const baseBonus = getBaseBonus(winRate);
  const confidenceRate = getConfidenceRate(total);
  const bonus = Math.round(baseBonus * confidenceRate);

  return {
    bonus,
    baseBonus,
    confidenceRate,
    winRate,
    total,
    win,
    lose,
  };
}