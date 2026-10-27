import test from "node:test";
import assert from "node:assert/strict";
import { assessDailyResultQuality } from "../../app/lib/learning/dailyResultResearchQuality.mjs";

const good = { date: "2026-09-22", score: 90, price: 100, next_price: 103, change_percent: 3, result: "WIN", provenance_verified: true };

test("accepts verified consistent observation", () => {
  assert.equal(assessDailyResultQuality(good).eligible, true);
});
test("quarantines suspect historical date", () => {
  assert.ok(assessDailyResultQuality({ ...good, date: "2026-09-21" }).reasons.includes("quarantined_date"));
});
test("rejects price/return mismatch", () => {
  assert.ok(assessDailyResultQuality({ ...good, change_percent: 0 }).reasons.includes("price_change_mismatch"));
});
test("rejects contradictory result", () => {
  assert.ok(assessDailyResultQuality({ ...good, result: "LOSE" }).reasons.includes("result_mismatch"));
});
test("rejects missing provenance", () => {
  assert.ok(assessDailyResultQuality({ ...good, provenance_verified: false }).reasons.includes("unverified_provenance"));
});
test("rejects null outcome and price", () => {
  assert.equal(assessDailyResultQuality({ ...good, next_price: null, change_percent: null }).eligible, false);
});
