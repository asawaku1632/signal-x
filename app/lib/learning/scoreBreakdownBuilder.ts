export function buildScoreBreakdown({
  scored,
  learningResult,
  learningBonus,
  patternLearningBonus,
  sectorBonus,
  experienceResult,
}: {
  scored: any;
  learningResult: any;
  learningBonus: number;
  patternLearningBonus: number;
  sectorBonus: number;
  experienceResult: any;
}) {
  const market = learningResult?.market ?? {
    bonus: 0,
    marketPattern: "NO_MARKET",
    winRate: 0,
    confidence: 0,
    source: "fixed",
  };

  const time = learningResult?.time ?? {
    bonus: 0,
    timeSlot: "UNKNOWN",
    winRate: 0,
    judged: 0,
    confidence: 0,
    source: "fixed",
  };

  const volatility = learningResult?.volatility ?? {
    bonus: 0,
    volatilityBand: "UNKNOWN",
    winRate: 0,
    judged: 0,
    confidence: 0,
    source: "fixed",
  };

  const event = learningResult?.event ?? {
    eventKey: "NO_EVENT",
    bonus: 0,
    winRate: 0,
    judged: 0,
    confidence: 0,
    source: "fixed",
  };

  const risk = learningResult?.risk ?? {
    riskKey: "MIDDLE_RISK",
    bonus: 0,
    winRate: 0,
    judged: 0,
    confidence: 0,
    source: "fixed",
  };

  const experience = experienceResult?.experience ?? { bonus: 0 };
  const similarExperience =
    experienceResult?.similarExperience ?? { bonus: 0 };
  const experienceRanking =
    experienceResult?.experienceRanking ?? { bonus: 0 };

  return {
    ...scored.scoreBreakdown,

    learning: learningBonus,

    market: market.bonus,
    marketLearning: market,

    time: time.bonus,
    timeLearning: time,

    volatility: volatility.bonus,
    volatilityLearning: volatility,

    event: event.bonus,
    eventLearning: event,

    risk: risk.bonus,
    riskLearning: risk,

    patternLearning: patternLearningBonus,
    sector: sectorBonus,

    experience: experience.bonus ?? 0,
    similarExperience: similarExperience.bonus ?? 0,
    experienceRanking: experienceRanking.bonus ?? 0,
  };
}
