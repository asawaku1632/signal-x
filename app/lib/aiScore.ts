export type StatsItem = {
  reason: string;
  total: number;
  win: number;
  lose: number;
  winRate: number;
  avgProfitRate: number;
  maxProfitRate: number;
  minProfitRate: number;
  learningPower?: number;
};

export const getLearningBonus = (
  reason: string,
  stats: StatsItem[]
) => {
  const matched = stats.find((item) => item.reason === reason);

  if (!matched) {
    return 0;
  }

  const winRate = matched.winRate || 0;
  const avgProfitRate = matched.avgProfitRate || 0;

  let bonus = 0;

  if (winRate >= 80) {
    bonus += 15;
  } else if (winRate >= 70) {
    bonus += 10;
  } else if (winRate >= 60) {
    bonus += 5;
  }

  if (winRate < 40) {
    bonus -= 15;
  } else if (winRate < 50) {
    bonus -= 8;
  }

  if (avgProfitRate >= 3) {
    bonus += 10;
  } else if (avgProfitRate >= 1) {
    bonus += 5;
  }

  if (avgProfitRate <= -3) {
    bonus -= 10;
  } else if (avgProfitRate < 0) {
    bonus -= 5;
  }

  return bonus;
};