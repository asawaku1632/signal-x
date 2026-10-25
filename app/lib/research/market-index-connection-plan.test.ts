import test from "node:test";
import assert from "node:assert/strict";
import { buildIndexConnectionPlan } from "./market-index-connection-plan.ts";
const complete = {
  indexKey: "nikkei", providerId: "example-provider",
  authenticatedLicense: true, authenticatedCalendar: true,
  licensedFeedConfigured: true, validatedObservation: true,
  retentionScopeConfirmed: true, redistributionScopeConfirmed: true,
  operatorApproval: true,
};
test("all caller flags never authorize network, storage, cron or production", () => {
  const x = buildIndexConnectionPlan(complete);
  assert.equal(x.readiness, "manual_review_candidate");
  assert.equal(x.allowNetworkFetch, false);
  assert.equal(x.allowDatabaseWrite, false);
  assert.equal(x.allowCron, false);
  assert.equal(x.allowProductionIntegration, false);
});
test("missing independent license check blocks manual readiness", () => {
  const x = buildIndexConnectionPlan({ ...complete, authenticatedLicense: false });
  assert.ok(x.blockers.includes("LICENSE"));
  assert.equal(x.readiness, "blocked");
});
test("provider placeholder and invalid index are blocked", () => {
  const x = buildIndexConnectionPlan({ ...complete, indexKey: "unknown", providerId: "licensed-provider-pending" });
  assert.ok(x.blockers.includes("INVALID_INDEX"));
  assert.ok(x.blockers.includes("UNVERIFIED_PROVIDER"));
});
test("truthy strings cannot bypass gates", () => {
  const x = buildIndexConnectionPlan({ ...complete, operatorApproval: "true", validatedObservation: 1 });
  assert.ok(x.blockers.includes("APPROVAL"));
  assert.ok(x.blockers.includes("QUALITY"));
});
