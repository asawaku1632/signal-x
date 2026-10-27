export type FrozenCandidate = {
  stockCode: string;
  aiPower: number;
  frozenAt: string;
  sessionDateJst: string;
  referencePrice: number;
};
export type ForwardResult = {
  stockCode: string;
  sessionDateJst: string;
  observedPrice: number;
  observedAt: string;
};
export type ReversalStudyPolicy = {
  lowScoreMax: number;
  highScoreMin: number;
  significantMovePct: number;
};

export const DEFAULT_REVERSAL_POLICY: ReversalStudyPolicy = {
  lowScoreMax: 40,
  highScoreMin: 80,
  significantMovePct: 3,
};

/** Research-only: classify *after* a valid forward observation, never claim prior prediction. */
export function evaluateRatingReversal(
  frozen: FrozenCandidate,
  forward: ForwardResult,
  policy: ReversalStudyPolicy = DEFAULT_REVERSAL_POLICY,
) {
  if (!/^\d{4}$/.test(frozen.stockCode) || frozen.stockCode !== forward.stockCode ||
      !Number.isFinite(frozen.aiPower) || frozen.aiPower < 0 || frozen.aiPower > 100 ||
      !Number.isFinite(frozen.referencePrice) || frozen.referencePrice <= 0 ||
      !Number.isFinite(forward.observedPrice) || forward.observedPrice <= 0 ||
      !Number.isFinite(policy.lowScoreMax) || !Number.isFinite(policy.highScoreMin) ||
      !Number.isFinite(policy.significantMovePct) || policy.significantMovePct <= 0 ||
      policy.lowScoreMax >= policy.highScoreMin)
    return { status: "invalid" as const, reason: "Invalid candidate, price or policy" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(frozen.sessionDateJst) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(forward.sessionDateJst) ||
      forward.sessionDateJst <= frozen.sessionDateJst)
    return { status: "not_forward" as const, reason: "Forward session required" };
  const frozenTime = Date.parse(frozen.frozenAt);
  const observedTime = Date.parse(forward.observedAt);
  if (!Number.isFinite(frozenTime) || !Number.isFinite(observedTime) || observedTime <= frozenTime)
    return { status: "invalid_timestamp" as const, reason: "Observation must follow frozen signal" };
  const changePct = (forward.observedPrice / frozen.referencePrice - 1) * 100;
  const category = frozen.aiPower <= policy.lowScoreMax && changePct >= policy.significantMovePct
    ? "low_score_rally" as const
    : frozen.aiPower >= policy.highScoreMin && changePct <= -policy.significantMovePct
      ? "high_score_decline" as const
      : "other" as const;
  return {
    status: "evaluated" as const, stockCode: frozen.stockCode,
    frozenDate: frozen.sessionDateJst, observedDate: forward.sessionDateJst,
    frozenAiPower: frozen.aiPower, changePct, category,
    retrospectiveOnly: true as const,
  };
}
