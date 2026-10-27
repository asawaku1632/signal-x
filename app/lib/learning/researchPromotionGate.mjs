// Research-only, pure and fail-closed. Never writes rules or authorizes deployment.
export function reviewLearningPromotion(evidence) {
  const reasons = [];
  const validCount = (v) => Number.isSafeInteger(v) && v >= 0;
  if (!evidence || typeof evidence !== "object") {
    return { status: "BLOCKED", reasons: ["MISSING_EVIDENCE"], eligibleForManualReview: false, productionApproved: false };
  }
  const { completedForwardCount, distinctCodes, distinctTradeDates, distinctMonths, baselineMeanReturn, candidateMeanReturn, outOfSample, independentPriceCheck, administratorApproved } = evidence;
  for (const [key, value, min] of [
    ["completedForwardCount", completedForwardCount, 100],
    ["distinctCodes", distinctCodes, 20],
    ["distinctTradeDates", distinctTradeDates, 20],
    ["distinctMonths", distinctMonths, 3],
  ]) {
    if (!validCount(value) || value < min) reasons.push("INSUFFICIENT_" + key.toUpperCase());
  }
  if (outOfSample !== true) reasons.push("OUT_OF_SAMPLE_NOT_VERIFIED");
  if (independentPriceCheck !== true) reasons.push("PRICE_NOT_VERIFIED");
  if (!Number.isFinite(baselineMeanReturn) || !Number.isFinite(candidateMeanReturn) ||
      candidateMeanReturn <= baselineMeanReturn) reasons.push("NO_VERIFIED_IMPROVEMENT");
  if (administratorApproved !== true) reasons.push("ADMIN_APPROVAL_MISSING");
  return {
    status: reasons.length ? "BLOCKED" : "REVIEW_READY",
    reasons,
    eligibleForManualReview: reasons.length === 0,
    productionApproved: false,
    note: "REVIEW_READY is research triage only. Independent authorization, rollout controls and monitoring remain required.",
  };
}
