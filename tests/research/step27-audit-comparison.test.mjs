import test from "node:test";
import assert from "node:assert/strict";
import { compareAuditGroups } from "../../app/lib/step27-audit-comparison.mjs";

const baseline = [{ jst_date: "2026-10-27", index_key: "nikkei", saved_count: 1 }];
const extra = { jst_date: "2026-10-27", index_key: "topix", saved_count: 1 };
test("STEP27-B: added group", () => {
  const result = compareAuditGroups(baseline, [...baseline, extra]);
  assert.equal(result.decision, "PASS");
  assert.deepEqual(result.changes.map(c => c.type), ["ADDED"]);
});
test("STEP27-B: changed count", () => {
  const result = compareAuditGroups(baseline, [{ ...baseline[0], saved_count: 3 }]);
  assert.equal(result.decision, "DUPLICATE_DETECTED");
  assert.deepEqual(result.changes.map(c => c.type), ["COUNT_CHANGED"]);
});
test("STEP27-B: missing group", () => {
  const result = compareAuditGroups([...baseline, extra], baseline);
  assert.deepEqual(result.changes.map(c => c.type), ["MISSING"]);
});
test("STEP27-B: duplicate detected without DB write", () => {
  const result = compareAuditGroups(baseline, [{ ...baseline[0], saved_count: 2 }]);
  assert.equal(result.duplicateGroups, 1);
  assert.equal(result.decision, "DUPLICATE_DETECTED");
});
test("STEP27-B: unchanged", () => {
  const result = compareAuditGroups(baseline, baseline);
  assert.equal(result.status, "UNCHANGED");
  assert.equal(result.changes.length, 0);
});
test("STEP27-B: no data is not PASS", () => {
  assert.equal(compareAuditGroups([], []).decision, "NO_DATA");
});
