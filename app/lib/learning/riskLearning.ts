export type RiskLearningResult = {
  riskKey: string;
  bonus: number;
  winRate: number;
  judged: number;
  confidence: number;
  source: "fixed" | "learning";
};

export function calculateRiskLearningBonus(params: {
  riskKey: string;
  riskBonus: number;
  stats?: {
    win?: number;
    lose?: number;
    hold?: number;
  };
}): RiskLearningResult {
  const win = params.stats?.win ?? 0;
  const lose = params.stats?.lose ?? 0;
  const judged = win + lose;
  const winRate = judged > 0 ? Math.round((win / judged) * 100) : 0;

  if (judged < 10) {
    return {
      riskKey: params.riskKey,
      bonus: params.riskBonus,
      winRate,
      judged,
      confidence: 0,
      source: "fixed",
    };
  }

  let bonus = 0;

  if (winRate >= 70) bonus = 5;
  else if (winRate >= 60) bonus = 3;
  else if (winRate >= 50) bonus = 1;
  else if (winRate <= 30) bonus = -5;
  else if (winRate <= 40) bonus = -3;

  return {
    riskKey: params.riskKey,
    bonus,
    winRate,
    judged,
    confidence: Math.min(100, judged * 5),
    source: "learning",
  };
}

export function getLearningRiskBonus(params: {
  riskKey: string;
  riskBonus: number;
  riskStatsMap?: Record<string, any>;
}): RiskLearningResult {
  const stats = params.riskStatsMap?.[params.riskKey];

  return calculateRiskLearningBonus({
    riskKey: params.riskKey,
    riskBonus: params.riskBonus,
    stats,
  });
}