export type CalculateFinalAiPowerInput = {
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
  bbBonus?: number;
};

export function calculateRawAiPower(input: CalculateFinalAiPowerInput) {
  return (
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
    (input.experienceRankingBonus ?? 0) +
    (input.bbBonus ?? 0)
  );
}

function roundToOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

export function calculateDisplayAiPower(rawAiPower: number) {
  if (!Number.isFinite(rawAiPower)) return 0;

  if (rawAiPower <= 85) {
    return roundToOneDecimal(Math.max(0, rawAiPower));
  }

  const decayedScore =
    85 + 15 * (1 - Math.exp(-(rawAiPower - 85) / 20));

  return roundToOneDecimal(Math.max(0, Math.min(100, decayedScore)));
}

export function calculateFinalAiPower(input: CalculateFinalAiPowerInput) {
  return calculateDisplayAiPower(calculateRawAiPower(input));
}

export function clampAiPower(score: number) {
  if (!Number.isFinite(score)) return 0;
  if (score < 0) return 0;
  if (score > 100) return 100;
  return Math.round(score);
}
