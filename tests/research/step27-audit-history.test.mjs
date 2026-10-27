import test from "node:test";
import assert from "node:assert/strict";
import { analyzeAuditHistory } from "../../app/lib/step27-audit-history.mjs";
const g = (count) => [{ jst_date: "2026-10-27", index_key: "nikkei", saved_count: count }];
const h = (day, count) => ({ audited_at: "2026-10-" + day + "T00:00:00Z", details: g(count) });
test("STEP27-D: single snapshot cannot establish recurrence", () => {
  const result = analyzeAuditHistory([h("27", 1)]);
  assert.equal(result.status, "INSUFFICIENT_HISTORY");
  assert.equal(result.comparableTransitions, 0);
});
test("STEP27-D: stable history has no repeated findings", () => {
  const result = analyzeAuditHistory([h("25", 1), h("26", 1), h("27", 1)]);
  assert.equal(result.status, "NO_REPEATED_ISSUES_OBSERVED");
  assert.equal(result.repeated.length, 0);
});
test("STEP27-D: recurring duplicate is detected", () => {
  const result = analyzeAuditHistory([h("25", 2), h("26", 2), h("27", 2)]);
  assert.equal(result.status, "REPEATED_ISSUES");
  assert.ok(result.repeated.some(x => x.key.includes("DUPLICATE") && x.count === 3));
});
test("STEP27-D: unsaved reads are not inferred", () => {
  const result = analyzeAuditHistory([]);
  assert.equal(result.snapshotCount, 0);
  assert.equal(result.status, "INSUFFICIENT_HISTORY");
});
