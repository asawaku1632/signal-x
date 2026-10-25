import test from "node:test";
import assert from "node:assert/strict";
import { assessLicenseResponseDraft } from "./market-index-license-response.ts";

const draft = {
  indexKey: "nikkei", providerId: "example-provider", contractReference: "claimed-reference",
  verifiedSigner: true, rightsForDisplay: true, rightsForAutomatedProcessing: true,
  rightsForRetention: true, rightsForRedistribution: true, rightsForPaidUsers: true,
  effectiveFrom: "2026-01-01", effectiveUntil: "2026-12-31", revocationChecked: true,
};
test("all self-attested claims still fail closed", () => {
  const x = assessLicenseResponseDraft(draft);
  assert.equal(x.authenticated, false);
  assert.equal(x.authorizedForProduction, false);
  assert.equal(x.status, "manual_review_only");
});
test("missing license terms are reported", () => {
  const x = assessLicenseResponseDraft({ ...draft, rightsForRetention: false, verifiedSigner: false });
  assert.ok(x.missingOrUnverified.includes("RIGHTSFORRETENTION_UNCONFIRMED"));
  assert.ok(x.missingOrUnverified.includes("SIGNER_UNVERIFIED"));
});
test("invalid dates and reversed validity are blocked", () => {
  for (const [from, until] of [["2026-02-30", "2026-12-31"], ["2026-12-31", "2026-01-01"]]) {
    const x = assessLicenseResponseDraft({ ...draft, effectiveFrom: from, effectiveUntil: until });
    assert.ok(x.missingOrUnverified.includes("CONTRACT_DATES_UNCONFIRMED"));
  }
});
test("truthy strings are not verified permissions", () => {
  const x = assessLicenseResponseDraft({ ...draft, rightsForDisplay: "true", revocationChecked: "yes" });
  assert.ok(x.missingOrUnverified.includes("RIGHTSFORDISPLAY_UNCONFIRMED"));
  assert.ok(x.missingOrUnverified.includes("REVOCATION_UNVERIFIED"));
});
test("placeholder provider is not evidence", () => {
  const x = assessLicenseResponseDraft({ ...draft, providerId: "licensed-provider-pending" });
  assert.ok(x.missingOrUnverified.includes("PROVIDER_UNCONFIRMED"));
});
