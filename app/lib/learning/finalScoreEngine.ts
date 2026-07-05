import { calculateFinalAiPower } from "@/app/lib/aiPowerEngine";
import { calculateLearningBonus } from "@/app/lib/learningBonus";
import { calculatePatternBonus } from "@/app/lib/patternBonus";
import { calculateSectorBonus } from "@/app/lib/sectorBonus";

const EMPTY_EXPERIENCE = {
  bonus: 0,
  winRate: 0,
  total: 0,
  win: 0,
  lose: 0,
  confidence: 0,
};

const EMPTY_SIMILAR_EXPERIENCE = {
  bonus: 0,
  baseBonus: 0,
  winRate: 0,
  total: 0,
  win: 0,
  lose: 0,
  confidence: 0,
  similarityRate: 0,
  similarCount: 0,
  averageSimilarity: 0,
  items: [],
};

const EMPTY_EXPERIENCE_RANKING = {
  bonus: 0,
  winRate: 0,
  total: 0,
  win: 0,
  lose: 0,
  confidence: 0,
  weightedWinRate: 0,
  weightedTotal: 0,
  averageSimilarity: 0,
  topCount: 0,
  items: [],
};

export function calculateFinalScoreContext(params: {
  scored: any;
  sectorKey: string;
  experienceKey: string;
  learningStatsMap: Map<string, any>;
  patternStatsMap: Map<string, any>;
  weightRuleMap: Map<string, any>;
  sectorStatsMap: Map<string, any>;
  sectorWeightRuleMap: Map<string, any>;
  experienceBonusMap: Map<string, any>;
  similarExperienceBonusMap: Map<string, any>;
  experienceRankingMap: Map<string, any>;
  marketBonus: number;
  timeBonus: number;
  volatilityBonus: number;
  eventBonus: number;
  riskBonus: number;
}) {
  const learningStats = params.learningStatsMap.get(params.scored.code);
  const judgedLearning =
    (learningStats?.win ?? 0) + (learningStats?.lose ?? 0);

  const learning =
    judgedLearning > 0
      ? calculateLearningBonus(learningStats?.winRate)
      : {
          bonus: 0,
          winRate: 0,
        };

  const patternStats = params.patternStatsMap.get(params.scored.patternKey);
  const pattern = calculatePatternBonus({
    win: patternStats?.win ?? 0,
    lose: patternStats?.lose ?? 0,
  });

  const weightRule = params.weightRuleMap.get(params.scored.patternKey);
  const finalPatternBonus = weightRule ? weightRule.bonus : pattern.bonus;

  const sectorStats = params.sectorStatsMap.get(params.sectorKey);
  const calculatedSector = calculateSectorBonus({
    win: sectorStats?.win ?? 0,
    lose: sectorStats?.lose ?? 0,
  });

  const sectorWeightRule = params.sectorWeightRuleMap.get(params.sectorKey);
  const finalSectorBonus = sectorWeightRule
    ? sectorWeightRule.bonus
    : calculatedSector.bonus;

  const experience =
    params.experienceBonusMap.get(params.experienceKey) || EMPTY_EXPERIENCE;

  const similarExperience =
    params.similarExperienceBonusMap.get(params.experienceKey) ||
    EMPTY_SIMILAR_EXPERIENCE;

  const experienceRanking =
    params.experienceRankingMap.get(params.experienceKey) ||
    EMPTY_EXPERIENCE_RANKING;

  const finalScore = calculateFinalAiPower({
    baseScore: params.scored.score,
    marketBonus: params.marketBonus,
    timeBonus: params.timeBonus,
    volatilityBonus: params.volatilityBonus,
    eventBonus: params.eventBonus,
    riskBonus: params.riskBonus,
    learningBonus: learning.bonus,
    patternBonus: finalPatternBonus,
    sectorBonus: finalSectorBonus,
    experienceBonus: experience.bonus,
    similarExperienceBonus: similarExperience.bonus,
    experienceRankingBonus: experienceRanking.bonus,
  });

  return {
    learning,
    finalPatternBonus,
    finalSectorBonus,
    experience,
    similarExperience,
    experienceRanking,
    finalScore,
  };
}
