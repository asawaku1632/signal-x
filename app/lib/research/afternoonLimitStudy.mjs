/** Pure, research-only, point-in-time afternoon limit-order study.
 * Prices must be independently verified and timestamped by an approved provider.
 * This module neither fetches quotes nor creates orders.
 */
export const AFTERNOON_LIMIT_STUDY_VERSION = "AFTERNOON_LIMIT_SHADOW_V1";
const valid = (n) => typeof n === "number" && Number.isFinite(n) && n > 0;
const unavailable = (reason) => ({ status: "UNAVAILABLE", reason });

export function evaluateAfternoonLimitStudy(input) {
  const { decisionAt, quoteAtDecision, targetLimit, postDecisionHigh,
    postDecisionLow, sessionClose, source, observedThrough } = input ?? {};
  if (![quoteAtDecision,targetLimit,postDecisionHigh,postDecisionLow,sessionClose].every(valid))
    return unavailable("MISSING_OR_INVALID_PRICE");
  if (!decisionAt || !observedThrough || !source)
    return unavailable("MISSING_PROVENANCE_OR_TIMESTAMPS");
  const decisionMs = Date.parse(decisionAt), observedMs = Date.parse(observedThrough);
  if (!Number.isFinite(decisionMs) || !Number.isFinite(observedMs) || observedMs <= decisionMs)
    return unavailable("INVALID_TIME_ORDER");
  if (postDecisionLow > postDecisionHigh || sessionClose < postDecisionLow || sessionClose > postDecisionHigh)
    return unavailable("INCONSISTENT_POST_DECISION_RANGE");
  if (targetLimit <= quoteAtDecision)
    return unavailable("LIMIT_NOT_ABOVE_DECISION_QUOTE");
  // Reaching the limit is NOT proof of execution: queue priority, volume,
  // market structure and missing intrabar timestamps remain unknown.
  const touched = postDecisionHigh >= targetLimit;
  return {
    status: "OBSERVED", policyVersion: AFTERNOON_LIMIT_STUDY_VERSION,
    source, decisionAt, observedThrough,
    quoteAtDecision, targetLimit,
    targetUpsidePct: (targetLimit / quoteAtDecision - 1) * 100,
    touched, fillStatus: touched ? "POSSIBLE_NOT_CONFIRMED" : "NOT_TOUCHED",
    maxAdverseMovePct: (postDecisionLow / quoteAtDecision - 1) * 100,
    sessionCloseVsDecisionPct: (sessionClose / quoteAtDecision - 1) * 100,
  };
}
