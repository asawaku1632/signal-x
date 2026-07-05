export type EventLearningResult = {
  eventKey: string;
  bonus: number;
  winRate: number;
  judged: number;
  confidence: number;
  source: "fixed" | "learning";
};

export function calculateEventLearningBonus(params: {
  eventKey: string;
  eventBonus: number;
  stats?: {
    win?: number;
    lose?: number;
    hold?: number;
  };
}): EventLearningResult {
  const win = params.stats?.win ?? 0;
  const lose = params.stats?.lose ?? 0;
  const judged = win + lose;
  const winRate = judged > 0 ? Math.round((win / judged) * 100) : 0;

  if (judged < 10) {
    return {
      eventKey: params.eventKey,
      bonus: params.eventBonus,
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
    eventKey: params.eventKey,
    bonus,
    winRate,
    judged,
    confidence: Math.min(100, judged * 5),
    source: "learning",
  };
}

export function getLearningEventBonus(params: {
  eventKey: string;
  eventBonus: number;
  eventStatsMap?: Record<string, any>;
}): EventLearningResult {
  const stats = params.eventStatsMap?.[params.eventKey];

  return calculateEventLearningBonus({
    eventKey: params.eventKey,
    eventBonus: params.eventBonus,
    stats,
  });
}