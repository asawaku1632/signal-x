import type {
  PatternForwardObservationInput,
  PatternForwardStats,
} from "./patternForwardLearning";

export type ValidatedPatternForwardBonus = {
  bonus: number;
  applied: boolean;
  patternId: string | null;
  patternName: string | null;
  direction: "BUY" | "SELL" | "NEUTRAL" | null;
  winRate5d: number | null;
  avgDirectionalReturn5d: number | null;
  completed5dCount: number;
  matchedValidatedCount: number;
  reason: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function calculateValidatedPatternStatBonus(
  stat: PatternForwardStats,
): number {
  if (
    stat.validationStatus !== "VALIDATED" ||
    stat.direction === "NEUTRAL" ||
    stat.winRate5d === null ||
    stat.avgDirectionalReturn5d === null
  ) {
    return 0;
  }

  let strength = 2;

  if (stat.winRate5d >= 65) strength += 1;
  if (stat.winRate5d >= 70) strength += 1;
  if (stat.avgDirectionalReturn5d >= 1.0) strength += 1;
  if (stat.avgDirectionalReturn5d >= 2.0) strength += 1;

  strength = clamp(strength, 2, 6);

  return stat.direction === "BUY" ? strength : -strength;
}

export function calculateValidatedPatternForwardBonus(
  observations: PatternForwardObservationInput[],
  statsMap: Map<string, PatternForwardStats>,
): ValidatedPatternForwardBonus {
  const matched = observations
    .map((observation) => {
      const stat = statsMap.get(observation.id);
      if (!stat) return null;
      if (stat.validationStatus !== "VALIDATED") return null;
      if (stat.direction !== observation.direction) return null;

      const bonus = calculateValidatedPatternStatBonus(stat);
      if (bonus === 0) return null;

      return { observation, stat, bonus };
    })
    .filter(
      (
        item,
      ): item is {
        observation: PatternForwardObservationInput;
        stat: PatternForwardStats;
        bonus: number;
      } => Boolean(item),
    );

  if (matched.length === 0) {
    return {
      bonus: 0,
      applied: false,
      patternId: null,
      patternName: null,
      direction: null,
      winRate5d: null,
      avgDirectionalReturn5d: null,
      completed5dCount: 0,
      matchedValidatedCount: 0,
      reason: "",
    };
  }

  matched.sort((a, b) => {
    if (Math.abs(b.bonus) !== Math.abs(a.bonus)) {
      return Math.abs(b.bonus) - Math.abs(a.bonus);
    }
    if ((b.stat.winRate5d ?? 0) !== (a.stat.winRate5d ?? 0)) {
      return (b.stat.winRate5d ?? 0) - (a.stat.winRate5d ?? 0);
    }
    return b.stat.completed5dCount - a.stat.completed5dCount;
  });

  const primary = matched[0];
  const sameDirectionCount = matched.filter(
    (item) => item.stat.direction === primary.stat.direction,
  ).length;

  let bonus = primary.bonus;
  if (sameDirectionCount >= 2) {
    bonus += primary.stat.direction === "BUY" ? 1 : -1;
  }
  bonus = clamp(bonus, -6, 6);

  const sign = bonus > 0 ? "+" : "";
  return {
    bonus,
    applied: true,
    patternId: primary.stat.patternId,
    patternName: primary.stat.patternName,
    direction: primary.stat.direction,
    winRate5d: primary.stat.winRate5d,
    avgDirectionalReturn5d: primary.stat.avgDirectionalReturn5d,
    completed5dCount: primary.stat.completed5dCount,
    matchedValidatedCount: matched.length,
    reason:
      `検証済み実績 ${primary.stat.patternName}: 5日勝率${primary.stat.winRate5d?.toFixed(1)}% / ` +
      `平均${primary.stat.avgDirectionalReturn5d !== null && primary.stat.avgDirectionalReturn5d >= 0 ? "+" : ""}` +
      `${primary.stat.avgDirectionalReturn5d?.toFixed(2)}% → AI POWER ${sign}${bonus}`,
  };
}
