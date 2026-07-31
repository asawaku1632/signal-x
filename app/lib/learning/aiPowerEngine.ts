import {
  calculateDisplayAiPower,
  calculateFinalAiPower,
  calculateRawAiPower,
} from "@/app/lib/aiPowerEngine";

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
  return calculateFinalAiPower(params);
}

export function calculateAiPowerResult(params: CalculateAiPowerParams) {
  const rawAiPower = calculateRawAiPower(params);

  return {
    rawAiPower,
    displayAiPower: calculateDisplayAiPower(rawAiPower),
  };
}

export function buildStockAiPowerResult(params: CalculateAiPowerParams) {
  return calculateAiPower(params);
}
