import type { BollingerSignal } from "@/app/lib/bollingerBands";

export const BOLLINGER_AI_POWER_ENABLED = true;
export const BOLLINGER_BONUS_MIN = -3;
export const BOLLINGER_BONUS_MAX = 3;

export type BollingerBonusResult = {
  bonus: number;
  reason: string;
  enabled: boolean;
};

function clampBonus(value: number) {
  return Math.max(BOLLINGER_BONUS_MIN, Math.min(BOLLINGER_BONUS_MAX, value));
}

export function calculateBollingerBonus(
  signal: BollingerSignal | undefined,
  enabled = BOLLINGER_AI_POWER_ENABLED,
): BollingerBonusResult {
  if (!enabled || !signal || signal.side === "NONE") {
    return { bonus: 0, reason: "", enabled };
  }

  if (signal.side === "LOWER_REBOUND") {
    if (signal.status !== "CONFIRMED" || signal.bandWalkRisk === "HIGH") {
      return { bonus: 0, reason: "", enabled };
    }

    const bonus = signal.bandWalkRisk === "MEDIUM"
      ? 1
      : signal.expectation >= 60
        ? 3
        : 2;

    return {
      bonus: clampBonus(bonus),
      reason: "日足BB−2σ付近から反発確認があり、短期反発条件が重なっています。",
      enabled,
    };
  }

  if (signal.upperRegime === "UPPER_REVERSAL") {
    const bonus = signal.status === "CONFIRMED"
      ? signal.expectation >= 60
        ? -3
        : -2
      : signal.status === "TOUCHED" || signal.status === "BREACHED"
        ? -1
        : 0;

    return {
      bonus: clampBonus(bonus),
      reason: bonus < 0
        ? "日足BB＋2σ付近で失速サインが重なっており、短期的な過熱に注意が必要です。"
        : "",
      enabled,
    };
  }

  return { bonus: 0, reason: "", enabled };
}
