import test from "node:test";
import assert from "node:assert/strict";
import { reviewLiveDailyReference } from "../app/lib/research/jQuantsLiveReferenceReview.mjs";

const args = { apiKey: "secret", code: "3996", tradeDate: "2026-07-01", signalReference: 250 };
test("live comparison remains manual and redacts all price values", async () => {
  const result = await reviewLiveDailyReference({ ...args, fetchImpl: async (url, options) => {
    assert.equal(url.searchParams.get("code"), "39960");
    assert.equal(options.headers["x-api-key"], "secret");
    return { ok: true, status: 200, json: async () => ({ data: [{ Code: "39960", Date: "2026-07-01", C: 245 }] }) };
  } });
  assert.equal(result.status, "REVIEW_REQUIRED");
  assert.ok(result.reasons.includes("PRICE_BASIS_UNCONFIRMED"));
  assert.ok(result.reasons.includes("CORPORATE_ACTION_UNREVIEWED"));
  assert.equal(result.canPublishReturn, false);
  assert.equal(JSON.stringify(result).includes("245"), false);
  assert.equal(JSON.stringify(result).includes("secret"), false);
});
test("invalid input does not call provider", async () => {
  const result = await reviewLiveDailyReference({ ...args, signalReference: 0, fetchImpl: () => { throw Error("called"); } });
  assert.equal(result.status, "INVALID_INPUT");
});
test("ambiguous provider response cannot pass review", async () => {
  const result = await reviewLiveDailyReference({ ...args, fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ data: [] }) }) });
  assert.equal(result.status, "AMBIGUOUS_RESPONSE");
  assert.equal(result.canPublishReturn, false);
});
