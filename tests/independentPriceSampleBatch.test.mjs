import test from "node:test";
import assert from "node:assert/strict";
import { compareResearchSampleRows, MAX_RESEARCH_COMPARISONS } from "../app/lib/research/independentPriceSampleBatch.mjs";

const sample = (code, tradeDate) => ({
  code, tradeDate, signalReference: 250, independentClose: 249,
  independentCode: code, independentDate: tradeDate,
  independentSource: "manual-independent-daily-reference",
  samePriceBasis: true, corporateActionReviewed: true,
  retrievalTimestamp: "2026-10-21T08:00:00Z",
});

test("fixed sample aggregates comparison without granting verified returns", () => {
  const result = compareResearchSampleRows([
    sample("3996", "2026-10-20"),
    { ...sample("3762", "2026-10-20"), independentDate: "2026-10-19" },
  ]);
  assert.equal(result.total, 2);
  assert.equal(result.comparableForManualReview, 1);
  assert.equal(result.reviewRequired, 1);
  assert.equal(result.reasonCounts.DATE_MISMATCH, 1);
  assert.equal(result.verifiedReturns, 0);
  assert.ok(result.results.every((row) => row.canPublishReturn === false));
});

test("rejects duplicates and out-of-sample stocks", () => {
  assert.throws(() => compareResearchSampleRows([
    sample("3996", "2026-10-20"), sample("3996", "2026-10-20"),
  ]), /DUPLICATE_RESEARCH_SAMPLE/);
  assert.throws(() => compareResearchSampleRows([sample("9984", "2026-10-20")]), /CODE_OUTSIDE_RESEARCH_SAMPLE/);
});

test("rejects oversized or invalid batches", () => {
  assert.throws(() => compareResearchSampleRows(null), /INVALID_RESEARCH_BATCH/);
  assert.throws(() => compareResearchSampleRows(Array(MAX_RESEARCH_COMPARISONS + 1).fill({})), /INVALID_RESEARCH_BATCH/);
});
