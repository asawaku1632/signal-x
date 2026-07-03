export type SectorBonusInput = {
  win: number;
  lose: number;
};

export type SectorBonusResult = {
  bonus: number;
  winRate: number;
  total: number;
  win: number;
  lose: number;
};

export function calculateSectorBonus({
  win,
  lose,
}: SectorBonusInput): SectorBonusResult {
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

  if (winRate >= 85)
    return { bonus: 10, winRate, total, win, lose };

  if (winRate >= 75)
    return { bonus: 8, winRate, total, win, lose };

  if (winRate >= 65)
    return { bonus: 5, winRate, total, win, lose };

  if (winRate >= 55)
    return { bonus: 2, winRate, total, win, lose };

  if (winRate >= 45)
    return { bonus: 0, winRate, total, win, lose };

  if (winRate >= 35)
    return { bonus: -3, winRate, total, win, lose };

  if (winRate >= 25)
    return { bonus: -6, winRate, total, win, lose };

  return {
    bonus: -10,
    winRate,
    total,
    win,
    lose,
  };
}