export function buildScoreBreakdown(params: {
  baseScoreBreakdown: Record<string, any>;
  marketBonus: number;
  marketLearning: any;
  timeBonus: number;
  timeLearning: any;
  volatilityBonus: number;
  volatilityLearning: any;
  eventKey: string;
  eventLearning: any;
  riskKey: string;
  riskLearning: any;
  learning: any;
  finalPatternBonus: number;
  finalSectorBonus: number;
  experience: any;
  similarExperience: any;
  experienceRanking: any;
}) {
  return {
    ...params.baseScoreBreakdown,

    market: params.marketBonus,
    marketLearning: params.marketLearning,

    time: params.timeBonus,
    timeLearning: params.timeLearning,

    volatility: params.volatilityBonus,
    volatilityLearning: params.volatilityLearning,

    event: params.eventLearning.bonus,
    eventLearning: {
      eventKey: params.eventKey,
      bonus: params.eventLearning.bonus,
      winRate: params.eventLearning.winRate,
      judged: params.eventLearning.judged,
      confidence: params.eventLearning.confidence,
      source: params.eventLearning.source,
    },

    risk: params.riskLearning.bonus,
    riskLearning: {
      riskKey: params.riskKey,
      bonus: params.riskLearning.bonus,
      winRate: params.riskLearning.winRate,
      judged: params.riskLearning.judged,
      confidence: params.riskLearning.confidence,
      source: params.riskLearning.source,
    },

    learning: params.learning.bonus,
    patternLearning: params.finalPatternBonus,
    sector: params.finalSectorBonus,
    experience: params.experience.bonus,
    similarExperience: params.similarExperience.bonus,
    experienceRanking: params.experienceRanking.bonus,
  };
}
