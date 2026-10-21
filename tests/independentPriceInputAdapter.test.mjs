import test from "node:test";
import assert from "node:assert/strict";
import { reviewIndependentPriceJson, MAX_RESEARCH_INPUT_BYTES } from "../app/lib/research/independentPriceInputAdapter.mjs";

const row = {
  code: "3996", tradeDate: "2026-10-20", signalReference: 250,
  independentClose: 249, independentCode: "3996", independentDate: "2026-10-20",
  independentSource: "manually-reviewed-reference", samePriceBasis: false,
  corporateActionReviewed: false, retrievalTimestamp: "2026-10-21T08:00:00Z",
};

test("accepts bounded offline evidence without verifying returns", () => {
  const result = reviewIndependentPriceJson(JSON.stringify({ schemaVersion: 1, rows: [row] }));
  assert.equal(result.total, 1);
  assert.equal(result.reviewRequired, 1);
  assert.equal(result.verifiedReturns, 0);
  assert.equal(result.results[0].canPublishReturn, false);
});

test("rejects unversioned, unexpected and invalid review flags", () => {
  assert.throws(() => reviewIndependentPriceJson(JSON.stringify({ rows: [row] })), /INVALID_RESEARCH_SCHEMA/);
  assert.throws(() => reviewIndependentPriceJson(JSON.stringify({ schemaVersion: 1, rows: [row], token: "secret" })), /UNEXPECTED_RESEARCH_FIELD/);
  assert.throws(() => reviewIndependentPriceJson(JSON.stringify({ schemaVersion: 1, rows: [{ ...row, verified: true }] })), /UNEXPECTED_RESEARCH_ROW_FIELD/);
  assert.throws(() => reviewIndependentPriceJson(JSON.stringify({ schemaVersion: 1, rows: [{ ...row, samePriceBasis: "true" }] })), /INVALID_RESEARCH_REVIEW_FLAGS/);
});

test("rejects malformed or oversized JSON", () => {
  assert.throws(() => reviewIndependentPriceJson("{"), /INVALID_RESEARCH_JSON/);
  assert.throws(() => reviewIndependentPriceJson("x".repeat(MAX_RESEARCH_INPUT_BYTES + 1)), /INVALID_RESEARCH_INPUT_SIZE/);
});
