import test from "node:test";
import assert from "node:assert/strict";
import { reviewLearningPromotion } from "../../app/lib/learning/researchPromotionGate.mjs";

const complete = {
  completedForwardCount: 100, distinctCodes: 20, distinctTradeDates: 20,
  distinctMonths: 3, baselineMeanReturn: 0.1, candidateMeanReturn: 0.3,
  outOfSample: true, independentPriceCheck: true, administratorApproved: true,
};
test("missing evidence fails closed", () => {
  const result = reviewLearningPromotion();
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.productionApproved, false);
});
test("win rate or sample alone cannot authorize promotion", () => {
  const result = reviewLearningPromotion({ ...complete, outOfSample: false, administratorApproved: false });
  assert.equal(result.status, "BLOCKED");
  assert.ok(result.reasons.includes("OUT_OF_SAMPLE_NOT_VERIFIED"));
  assert.ok(result.reasons.includes("ADMIN_APPROVAL_MISSING"));
});
test("insufficient independent coverage is blocked", () => {
  assert.equal(reviewLearningPromotion({ ...complete, distinctMonths: 1 }).status, "BLOCKED");
});
test("non-improving candidate is blocked", () => {
  assert.equal(reviewLearningPromotion({ ...complete, candidateMeanReturn: 0.1 }).status, "BLOCKED");
});
test("even complete evidence cannot authorize production", () => {
  const result = reviewLearningPromotion(complete);
  assert.equal(result.status, "REVIEW_READY");
  assert.equal(result.eligibleForManualReview, true);
  assert.equal(result.productionApproved, false);
});
