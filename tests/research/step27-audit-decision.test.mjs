import test from "node:test";
import assert from "node:assert/strict";
import { decideAuditNextStep } from "../../app/lib/step27-audit-decision.mjs";
test("one snapshot requires more evidence", () => {
  assert.equal(decideAuditNextStep({ state: "STABLE" }, { status: "INSUFFICIENT_HISTORY", snapshotCount: 1 }).state, "INSUFFICIENT_EVIDENCE");
});
test("current investigation takes priority", () => {
  assert.equal(decideAuditNextStep({ state: "INVESTIGATE" }, { status: "NO_REPEATED_ISSUES_OBSERVED", snapshotCount: 3 }).state, "INVESTIGATE");
});
test("recurrence takes priority", () => {
  assert.equal(decideAuditNextStep({ state: "STABLE" }, { status: "REPEATED_ISSUES", snapshotCount: 3 }).state, "INVESTIGATE");
});
test("new additions require review", () => {
  assert.equal(decideAuditNextStep({ state: "REVIEW_CHANGES" }, { status: "NO_REPEATED_ISSUES_OBSERVED", snapshotCount: 3 }).state, "REVIEW_CHANGES");
});
test("stable evidence continues monitoring", () => {
  assert.equal(decideAuditNextStep({ state: "STABLE" }, { status: "NO_REPEATED_ISSUES_OBSERVED", snapshotCount: 3 }).state, "CONTINUE_MONITORING");
});
