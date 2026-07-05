type CalculateFinalAiPowerInput = {
  baseScore: number;

  learningBonus?: number;
  patternBonus?: number;
  sectorBonus?: number;

  marketBonus?: number;
  timeBonus?: number;
  volatilityBonus?: number;
  eventBonus?: number;
  riskBonus?: number;

  experienceBonus?: number;
  similarExperienceBonus?: number;
  experienceRankingBonus?: number;
};

export function calculateFinalAiPower(input: CalculateFinalAiPowerInput) {
  const finalScore =
    input.baseScore +
    (input.learningBonus ?? 0) +
    (input.patternBonus ?? 0) +
    (input.sectorBonus ?? 0) +
    (input.marketBonus ?? 0) +
    (input.timeBonus ?? 0) +
    (input.volatilityBonus ?? 0) +
    (input.eventBonus ?? 0) +
    (input.riskBonus ?? 0) +
    (input.experienceBonus ?? 0) +
    (input.similarExperienceBonus ?? 0) +
    (input.experienceRankingBonus ?? 0);

  return clampAiPower(finalScore);
}

export function clampAiPower(score: number) {
  if (!Number.isFinite(score)) return 0;
  if (score < 0) return 0;
  if (score > 100) return 100;
  return Math.round(score);
}