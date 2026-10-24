import test from "node:test";
import assert from "node:assert/strict";
import { buildResearchDashboardModel } from "./market-index-dashboard-model.ts";

test("empty dashboard is explicitly research-only and not finalized", () => {
  const result = buildResearchDashboardModel([]);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.model.status, "research_only");
  assert.equal(result.model.total, 0);
  assert.equal(result.model.manualReviewCandidates, 0);
  assert.equal(result.model.blocked, 0);
  assert.deepEqual(result.model.blockedReasons, []);
  assert.equal(result.model.warnings.length, 3);
});

test("dashboard fails closed for malformed or oversized batches", () => {
  assert.deepEqual(buildResearchDashboardModel(null), {
    ok: false, reason: "INVALID_BATCH",
  });
  assert.deepEqual(buildResearchDashboardModel(Array(101).fill(null)), {
    ok: false, reason: "BATCH_TOO_LARGE",
  });
});

test("dashboard summarizes blocked inputs without including raw evidence", () => {
  const result = buildResearchDashboardModel([null, null]);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.model.total, 2);
  assert.equal(result.model.blocked, 2);
  assert.equal(result.model.manualReviewCandidates, 0);
  assert.equal(result.model.blockedReasons.length, 1);
  assert.equal(result.model.blockedReasons[0].count, 2);
  assert.equal(result.model.blockedReasons[0].code, "INVALID_BUNDLE");
  assert.equal(JSON.stringify(result).includes("providerId"), false);
  assert.equal(JSON.stringify(result).includes("evidenceId"), false);
});
