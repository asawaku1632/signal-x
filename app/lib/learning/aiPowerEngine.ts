import { getStockLearningContext } from "@/app/lib/learning/learningEngine";
import { calculateFinalScoreContext } from "@/app/lib/learning/finalScoreEngine";
import { buildScoreBreakdown } from "@/app/lib/learning/scoreBreakdownBuilder";

function buildTimeLearningReason(timeLearning: any) {
  if (timeLearning.bonus > 0) return `時間帯学習 +${timeLearning.bonus}`;
  if (timeLearning.bonus < 0) return `時間帯学習 ${timeLearning.bonus}`;
  return "";
}

function buildRank(score: number) {
  if (score >= 85) return "S";
  if (score >= 70) return "A";
  if (score >= 50) return "B";
  return "C";
}

export async function buildStockAiPowerResult(params: {
  scored: any;
  sectorKey: string;
  sectorLabel: string;
  experienceKey: string;
  marketPattern: string;
  marketBonus: number;
  marketLearning: any;
  timeBonus: number;
  timeLearning: any;
  learningStatsMap: Map<string, any>;
  patternStatsMap: Map<string, any>;
  weightRuleMap: Map<string, any>;
  sectorStatsMap: Map<string, any>;
  sectorWeightRuleMap: Map<string, any>;
  experienceBonusMap: Map<string, any>;
  similarExperienceBonusMap: Map<string, any>;
  experienceRankingMap: Map<string, any>;
}) {
  const volatility = Math.abs(params.scored.changePercent ?? 0);

  const {
    volatilityLearning,
    volatilityBonus,
    eventBonus,
    eventKey,
    eventLearning,
    riskBonus,
    riskKey,
    riskLearning,
  } = await getStockLearningContext({
    scored: params.scored,
    volatility,
  });

  const {
    learning,
    finalPatternBonus,
    finalSectorBonus,
    experience,
    similarExperience,
    experienceRanking,
    finalScore,
  } = calculateFinalScoreContext({
    scored: params.scored,
    sectorKey: params.sectorKey,
    experienceKey: params.experienceKey,
    learningStatsMap: params.learningStatsMap,
    patternStatsMap: params.patternStatsMap,
    weightRuleMap: params.weightRuleMap,
    sectorStatsMap: params.sectorStatsMap,
    sectorWeightRuleMap: params.sectorWeightRuleMap,
    experienceBonusMap: params.experienceBonusMap,
    similarExperienceBonusMap: params.similarExperienceBonusMap,
    experienceRankingMap: params.experienceRankingMap,
    marketBonus: params.marketBonus,
    timeBonus: params.timeBonus,
    volatilityBonus,
    eventBonus: eventLearning.bonus,
    riskBonus: riskLearning.bonus,
  });

  const reasons = [
    params.scored.reason,
    buildTimeLearningReason(params.timeLearning),
  ].filter(Boolean);

  return {
    ...params.scored,

    sectorKey: params.sectorKey,
    sectorLabel: params.sectorLabel,
    experienceKey: params.experienceKey,
    marketPattern: params.marketPattern,

    score: finalScore,
    aiPower: finalScore,
    timeSlot: params.timeLearning.timeSlot,
    timeBonusSource: params.timeLearning.source,
    timeWinRate: params.timeLearning.winRate,
    timeJudged: params.timeLearning.judged,
    timeConfidence: params.timeLearning.confidence,

    rank: buildRank(finalScore),

    scoreBreakdown: buildScoreBreakdown({
      baseScoreBreakdown: params.scored.scoreBreakdown,
      marketBonus: params.marketBonus,
      marketLearning: params.marketLearning,
      timeBonus: params.timeBonus,
      timeLearning: params.timeLearning,
      volatilityBonus,
      volatilityLearning,
      eventKey,
      eventLearning,
      riskKey,
      riskLearning,
      learning,
      finalPatternBonus,
      finalSectorBonus,
      experience,
      similarExperience,
      experienceRanking,
    }),

    reason: reasons.join("・"),
  };
}
