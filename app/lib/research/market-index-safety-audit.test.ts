import test from "node:test";
import assert from "node:assert/strict";
import { auditIndexResearchSafety } from "./market-index-safety-audit.ts";
const connection = {
  indexKey: "nikkei", providerId: "example-provider", authenticatedLicense: true,
  authenticatedCalendar: true, licensedFeedConfigured: true,
  validatedObservation: true, retentionScopeConfirmed: true,
  redistributionScopeConfirmed: true, operatorApproval: true,
};
const license = {
  indexKey: "nikkei", providerId: "example-provider", contractReference: "self-claim",
  verifiedSigner: true, rightsForDisplay: true,
  rightsForAutomatedProcessing: true, rightsForRetention: true,
  rightsForRedistribution: true, rightsForPaidUsers: true,
  effectiveFrom: "2026-01-01", effectiveUntil: "2026-12-31",
  revocationChecked: true,
};
test("all self-attested claims cannot activate anything", () => {
  const a = auditIndexResearchSafety({ connection, license });
  assert.equal(a.state, "blocked");
  assert.deepEqual([a.mayFetch, a.mayPersist, a.maySchedule, a.mayUseInProduction], [false,false,false,false]);
  assert.ok(a.findings.includes("MANUAL_REVIEW_IS_NOT_AUTHORIZATION"));
  assert.ok(a.findings.includes("SELF_ATTESTED_LICENSE_IS_NOT_AUTHORIZATION"));
});
test("index mismatch is visible without leaking evidence", () => {
  const a = auditIndexResearchSafety({ connection, license: { ...license, indexKey: "topix" } });
  assert.ok(a.findings.includes("INDEX_SCOPE_MISMATCH"));
});
test("provider mismatch is visible", () => {
  const a = auditIndexResearchSafety({ connection, license: { ...license, providerId: "another" } });
  assert.ok(a.findings.includes("PROVIDER_SCOPE_MISMATCH"));
});
test("missing permissions and connection flags stay blocked", () => {
  const a = auditIndexResearchSafety({ connection: { ...connection, authenticatedLicense: false },
    license: { ...license, rightsForDisplay: false } });
  assert.ok(a.findings.includes("CONNECTION_LICENSE"));
  assert.ok(a.findings.includes("LICENSE_RIGHTSFORDISPLAY_UNCONFIRMED"));
  assert.equal(a.mayFetch, false);
});
