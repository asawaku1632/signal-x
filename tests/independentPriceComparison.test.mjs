import test from "node:test";
import assert from "node:assert/strict";
import { compareIndependentDailyReference } from "../app/lib/research/independentPriceComparison.mjs";

const sample = {
  code: "3996", tradeDate: "2026-10-20", signalReference: 250,
  independentClose: 249, independentCode: "3996", independentDate: "2026-10-20",
  independentSource: "independent-daily-feed", samePriceBasis: true,
  corporateActionReviewed: true, retrievalTimestamp: "2026-10-21T08:00:00Z",
};

test("comparable reference is still not proof of an activation fill", () => {
  const result = compareIndependentDailyReference(sample);
  assert.equal(result.comparisonStatus, "COMPARABLE_FOR_MANUAL_REVIEW");
  assert.equal(result.differenceYen, -1);
  assert.equal(result.differencePct, -0.4);
  assert.equal(result.baselineVerified, false);
  assert.equal(result.futurePriceVerified, false);
  assert.equal(result.canPublishReturn, false);
});

test("wrong code, date and price basis fail closed", () => {
  const result = compareIndependentDailyReference({
    ...sample, independentCode: "3762", independentDate: "2026-10-19",
    samePriceBasis: false, corporateActionReviewed: false,
  });
  assert.deepEqual(result.reasons.filter((reason) => reason.endsWith("MISMATCH")),
    ["CODE_MISMATCH", "DATE_MISMATCH"]);
  assert.ok(result.reasons.includes("PRICE_BASIS_UNCONFIRMED"));
  assert.ok(result.reasons.includes("CORPORATE_ACTION_UNREVIEWED"));
  assert.equal(result.canPublishReturn, false);
});

test("invalid prices and missing source metadata never pass review", () => {
  const result = compareIndependentDailyReference({
    ...sample, independentClose: 0, independentSource: "", retrievalTimestamp: null,
  });
  assert.equal(result.differenceYen, null);
  assert.ok(result.reasons.includes("INVALID_INDEPENDENT_PRICE"));
  assert.ok(result.reasons.includes("SOURCE_UNDOCUMENTED"));
  assert.ok(result.reasons.includes("RETRIEVAL_TIME_MISSING"));
});

test("non-UTC or timezone-ambiguous retrieval times are rejected", () => {
  for (const timestamp of ["2026-10-21T08:00:00", "2026-10-21T17:00:00+09:00"]) {
    const result = compareIndependentDailyReference({ ...sample, retrievalTimestamp: timestamp });
    assert.ok(result.reasons.includes("RETRIEVAL_TIME_MISSING"));
    assert.equal(result.canPublishReturn, false);
  }
});

test("valid UTC retrieval timestamp is accepted for manual comparison", () => {
  const result = compareIndependentDailyReference(sample);
  assert.equal(result.reasons.includes("RETRIEVAL_TIME_MISSING"), false);
  assert.equal(result.comparisonStatus, "COMPARABLE_FOR_MANUAL_REVIEW");
  assert.equal(result.canPublishReturn, false);
});
