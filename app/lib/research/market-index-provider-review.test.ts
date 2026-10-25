import test from "node:test";
import assert from "node:assert/strict";
import { reviewProviderDraft } from "./market-index-provider-review.ts";

const complete = {
  providerName: "example only", coveredIndices: ["nikkei", "topix"],
  dataRedistributionAllowed: true, retentionAllowed: true,
  commercialDisplayAllowed: true, derivedAnalyticsAllowed: true,
  automatedFetchAllowed: true, contractualEvidenceReference: "unverified-claim",
  exchangeCalendarSource: "unverified-claim", rateLimitDocumented: true,
};
test("empty provider draft has explicit unresolved issues", () => {
  const x = reviewProviderDraft({ ...complete, providerName: "", coveredIndices: [],
    contractualEvidenceReference: "", exchangeCalendarSource: "",
    dataRedistributionAllowed: false });
  assert.equal(x.eligibleForProduction, false);
  assert.equal(x.evidenceAuthenticated, false);
  assert.ok(x.issues.includes("PROVIDER_UNNAMED"));
  assert.ok(x.issues.includes("CONTRACT_EVIDENCE_MISSING"));
});
test("even complete self-attested claims never authorize production", () => {
  const x = reviewProviderDraft(complete);
  assert.equal(x.issues.length, 0);
  assert.equal(x.status, "manual_contract_review_required");
  assert.equal(x.eligibleForProduction, false);
  assert.equal(x.evidenceAuthenticated, false);
});
test("index coverage must include both named indices exactly", () => {
  const x = reviewProviderDraft({ ...complete, coveredIndices: ["nikkei", "nikkei"] });
  assert.ok(x.issues.includes("INDEX_COVERAGE_UNCONFIRMED"));
});
test("truthy nonboolean permissions are rejected", () => {
  const x = reviewProviderDraft({ ...complete, automatedFetchAllowed: "yes" });
  assert.ok(x.issues.includes("AUTOMATEDFETCHALLOWED_UNCONFIRMED"));
});
