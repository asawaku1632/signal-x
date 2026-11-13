import test from "node:test";
import assert from "node:assert/strict";
import { classifyScanProvenance } from "../app/lib/learning/scanProvenance.mjs";

const generatedAt = "2026-11-13T00:18:45.000Z";
const bar = (date) => Date.parse(date) / 1000;
const valid = {
  generatedAt,
  latestBarTimestamp: bar("2026-11-13T00:06:00Z"),
  dataSource: "intraday",
  learningAsOf: "2026-11-13T00:00:00Z",
};
test("same-day 09:06 intraday passes timestamp gate, not full proof", () => {
  assert.deepEqual(classifyScanProvenance(valid), { eligiblePost905: true, reason: "TIMESTAMPS_PASS_NOT_FULL_PROVENANCE" });
});
for (const [name, changes, reason] of [
  ["previous day", { latestBarTimestamp: bar("2026-11-12T00:00:00Z") }, "STALE_BAR"],
  ["09:03 bar", { latestBarTimestamp: bar("2026-11-13T00:03:25Z") }, "BEFORE_0905_BAR"],
  ["future bar", { latestBarTimestamp: bar("2026-11-13T00:19:00Z") }, "FUTURE_BAR"],
  ["daily fallback", { dataSource: "daily_fallback" }, "NOT_INTRADAY"],
  ["unknown source", { dataSource: null }, "NOT_INTRADAY"],
  ["no learning as-of", { learningAsOf: null }, "MISSING_LEARNING_ASOF"],
  ["future learning", { learningAsOf: "2026-11-13T00:19:00Z" }, "FUTURE_LEARNING"],
  ["missing timestamp", { latestBarTimestamp: null }, "MISSING_OR_INVALID_TIMESTAMP"],
  ["bad generated time", { generatedAt: "invalid" }, "MISSING_OR_INVALID_TIMESTAMP"],
]) {
  test(name, () => {
    assert.equal(classifyScanProvenance({ ...valid, ...changes }).reason, reason);
    assert.equal(classifyScanProvenance({ ...valid, ...changes }).eligiblePost905, false);
  });
}
