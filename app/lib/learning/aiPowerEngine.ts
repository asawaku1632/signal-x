import { calculateFinalAiPower } from "@/app/lib/aiPowerEngine";

export type CalculateAiPowerParams = {
  baseScore: number;
  marketBonus: number;
  timeBonus: number;
  volatilityBonus: number;
  eventBonus: number;
  riskBonus: number;
  learningBonus: number;
  patternBonus: number;
  sectorBonus: number;
  experienceBonus: number;
  similarExperienceBonus: number;
  experienceRankingBonus: number;
};

export function calculateAiPower(params: CalculateAiPowerParams) {
  return calculateFinalAiPower({
    baseScore: params.baseScore,
    marketBonus: params.marketBonus,
    timeBonus: params.timeBonus,
    volatilityBonus: params.volatilityBonus,
    eventBonus: params.eventBonus,
    riskBonus: params.riskBonus,
    learningBonus: params.learningBonus,
    patternBonus: params.patternBonus,
    sectorBonus: params.sectorBonus,
    experienceBonus: params.experienceBonus,
    similarExperienceBonus: params.similarExperienceBonus,
    experienceRankingBonus: params.experienceRankingBonus,
  });
}

export function buildStockAiPowerResult(params: CalculateAiPowerParams) {
  return calculateAiPower(params);
}
