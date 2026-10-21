import test from "node:test";
import assert from "node:assert/strict";
import { reviewJQuantsV2DailyResponse } from "../app/lib/research/jQuantsV2ResponseAdapter.mjs";

const sample = { code: "3996", tradeDate: "2026-10-20", signalReference: 250 };
const response = { data: [{ Code: "39960", Date: "2026-10-20", C: 250, AdjC: 249, AdjFactor: 1 }] };
const run = (data) => reviewJQuantsV2DailyResponse({
  response: data, sample, retrievalTimestamp: "2026-10-21T08:00:00Z",
});

test("accepts documented response envelope for manual review only", () => {
  const result = run(response);
  assert.equal(result.total, 1);
  assert.equal(result.verifiedReturns, 0);
  assert.equal(result.results[0].canPublishReturn, false);
});

test("rejects pagination, multiple bars, wrong code or date", () => {
  assert.throws(() => run({ ...response, pagination_key: "next" }), /INVALID_OR_PAGINATED/);
  assert.throws(() => run({ data: [...response.data, ...response.data] }), /INVALID_OR_PAGINATED/);
  assert.throws(() => run({ data: [{ ...response.data[0], Code: "37620" }] }), /JQUANTS_CODE_DATE_MISMATCH/);
  assert.throws(() => run({ data: [{ ...response.data[0], Date: "2026-10-19" }] }), /JQUANTS_CODE_DATE_MISMATCH/);
});
