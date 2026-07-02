export type LearningBonus = {
  bonus: number;
  winRate: number;
};

export function calculateLearningBonus(
  winRate: number | null | undefined
): LearningBonus {
  if (winRate == null || Number.isNaN(winRate)) {
    return {
      bonus: 0,
      winRate: 0,
    };
  }

  if (winRate >= 90) {
    return { bonus: 10, winRate };
  }

  if (winRate >= 80) {
    return { bonus: 8, winRate };
  }

  if (winRate >= 70) {
    return { bonus: 6, winRate };
  }

  if (winRate >= 60) {
    return { bonus: 4, winRate };
  }

  if (winRate >= 50) {
    return { bonus: 2, winRate };
  }

  if (winRate >= 40) {
    return { bonus: -2, winRate };
  }

  if (winRate >= 30) {
    return { bonus: -5, winRate };
  }

  return {
    bonus: -10,
    winRate,
  };
}