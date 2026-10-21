import test from "node:test";
import assert from "node:assert/strict";
import { reviewJQuantsDailyBarSample } from "../app/lib/research/jQuantsDailyBarOfflineAdapter.mjs";

const row = {
  code: "3996", tradeDate: "2026-10-20", signalReference: 250,
  retrievalTimestamp: "2026-10-21T08:00:00Z",
  bar: { Code: "39960", Date: "2026-10-20", AdjC: 249 },
};

test("J-Quants-like adjusted daily close is not an independently verified activation price", () => {
  const result = reviewJQuantsDailyBarSample({ rows: [row] });
  assert.equal(result.total, 1);
  assert.equal(result.verifiedReturns, 0);
  assert.equal(result.sourceDataAuthenticated, false);
  assert.equal(result.reviewRequired, 1);
  assert.ok(result.results[0].reasons.includes("PRICE_BASIS_UNCONFIRMED"));
  assert.ok(result.results[0].reasons.includes("CORPORATE_ACTION_UNREVIEWED"));
});

test("mismatched code suffix and date are explicitly flagged", () => {
  const result = reviewJQuantsDailyBarSample({ rows: [{
    ...row, bar: { Code: "39961", Date: "2026-10-19", AdjC: 249 },
  }] });
  assert.ok(result.results[0].reasons.includes("CODE_MISMATCH"));
  assert.ok(result.results[0].reasons.includes("DATE_MISMATCH"));
});

test("missing daily close is rejected, not silently replaced by raw close", () => {
  const result = reviewJQuantsDailyBarSample({ rows: [{
    ...row, bar: { Code: "39960", Date: "2026-10-20", C: 250, AdjC: null },
  }] });
  assert.ok(result.results[0].reasons.includes("INVALID_INDEPENDENT_PRICE"));
});
