import test from "node:test";
import assert from "node:assert/strict";
import {
  assessRightsEvidenceDraft,
  assessSessionEvidenceDraft,
  assessClaimedRightsCoverage,
  compareSessionEvidenceClaims,
  assessResearchEvidenceBundle,
  summarizeResearchEvidenceForManualReview,
  type RightsEvidenceDraft,
  type SessionEvidenceDraft,
} from "./market-index-evidence-review.ts";

const rights: RightsEvidenceDraft = {
  providerId: "fixture-provider",
  evidenceId: "fixture-evidence",
  verifierId: "fixture-verifier",
  allowedIndices: ["nikkei", "topix"],
  permittedUses: ["internal_research"],
  validFrom: "2026-01-01",
  validUntil: "2026-12-31",
  revoked: false,
};
const session: SessionEvidenceDraft = {
  indexKey: "nikkei",
  sessionDate: "2026-10-23",
  calendarSourceId: "fixture-calendar",
  calendarVersion: "fixture-v1",
  verifierId: "fixture-verifier",
  sessionClaim: "open",
};
test("complete synthetic rights draft is reviewable, not authorized", () => {
  assert.deepEqual(assessRightsEvidenceDraft(rights), {
    reviewable: true, providerId: "fixture-provider", evidenceId: "fixture-evidence",
  });
});
test("rights intake fails closed for invalid provenance", () => {
  for (const providerId of ["", "LICENSED-PROVIDER-PENDING", " licensed-provider-pending "]) {
    assert.deepEqual(assessRightsEvidenceDraft({ ...rights, providerId }), {
      reviewable: false, reason: "MISSING_PROVENANCE",
    });
  }
});
test("rights intake rejects absent, duplicate and unsupported scopes", () => {
  for (const allowedIndices of [[], ["nikkei", "nikkei"], ["unknown"], "nikkei"]) {
    assert.deepEqual(assessRightsEvidenceDraft({ ...rights, allowedIndices }), {
      reviewable: false, reason: "INVALID_INDEX_SCOPE",
    });
  }
  for (const permittedUses of [[], ["retain", "retain"], ["redistribute"], "display"]) {
    assert.deepEqual(assessRightsEvidenceDraft({ ...rights, permittedUses }), {
      reviewable: false, reason: "INVALID_USE_SCOPE",
    });
  }
});
test("rights intake rejects invalid dates, expired ordering and revocation", () => {
  for (const changes of [
    { validFrom: "2026-02-30" },
    { validUntil: "2026-00-01" },
    { validFrom: "2027-01-01" },
  ]) {
    assert.deepEqual(assessRightsEvidenceDraft({ ...rights, ...changes }), {
      reviewable: false, reason: "INVALID_VALIDITY",
    });
  }
  for (const revoked of [true, undefined, "false"]) {
    assert.deepEqual(assessRightsEvidenceDraft({ ...rights, revoked }), {
      reviewable: false, reason: "REVOCATION_NOT_CLEARED",
    });
  }
});
test("calendar intake checks provenance shape without claiming a trading day", () => {
  assert.deepEqual(assessSessionEvidenceDraft(session), {
    reviewable: true, indexKey: "nikkei", sessionDate: "2026-10-23",
  });
  assert.deepEqual(assessSessionEvidenceDraft({ ...session, sessionClaim: "closed" }), {
    reviewable: true, indexKey: "nikkei", sessionDate: "2026-10-23",
  });
});
test("calendar intake rejects malformed date, missing provenance and unsupported claims", () => {
  for (const [change, reason] of [
    [{ sessionDate: "2026-02-30" }, "INVALID_DATE"],
    [{ calendarSourceId: "" }, "MISSING_CALENDAR_PROVENANCE"],
    [{ sessionClaim: true }, "INVALID_SESSION_CLAIM"],
    [{ indexKey: "other" }, "INVALID_INDEX"],
  ] as const) {
    assert.deepEqual(assessSessionEvidenceDraft({ ...session, ...change }), {
      reviewable: false, reason,
    });
  }
});
test("non-object inputs fail closed", () => {
  assert.deepEqual(assessRightsEvidenceDraft(null as unknown as RightsEvidenceDraft), {
    reviewable: false, reason: "INVALID_EVIDENCE",
  });
  assert.deepEqual(assessSessionEvidenceDraft([] as unknown as SessionEvidenceDraft), {
    reviewable: false, reason: "INVALID_SESSION_EVIDENCE",
  });
});

test("claimed rights coverage matches only the explicitly requested scope", () => {
  assert.deepEqual(assessClaimedRightsCoverage(rights, {
    indexKey: "nikkei", use: "internal_research", sessionDate: "2026-10-23",
  }), { coveredByClaim: true });
  assert.deepEqual(assessClaimedRightsCoverage(rights, {
    indexKey: "nikkei", use: "display", sessionDate: "2026-10-23",
  }), { coveredByClaim: false, reason: "USE_NOT_COVERED" });
  assert.deepEqual(assessClaimedRightsCoverage({ ...rights, allowedIndices: ["nikkei"] }, {
    indexKey: "topix", use: "internal_research", sessionDate: "2026-10-23",
  }), { coveredByClaim: false, reason: "INDEX_NOT_COVERED" });
});

test("claimed rights coverage rejects out-of-range dates and invalid requests", () => {
  for (const sessionDate of ["2025-12-31", "2027-01-01"]) {
    assert.deepEqual(assessClaimedRightsCoverage(rights, {
      indexKey: "nikkei", use: "internal_research", sessionDate,
    }), { coveredByClaim: false, reason: "DATE_NOT_COVERED" });
  }
  assert.deepEqual(assessClaimedRightsCoverage(rights, {
    indexKey: "nikkei", use: "internal_research", sessionDate: "2026-02-30",
  }), { coveredByClaim: false, reason: "INVALID_REQUEST_DATE" });
  assert.deepEqual(assessClaimedRightsCoverage({ ...rights, revoked: true }, {
    indexKey: "nikkei", use: "internal_research", sessionDate: "2026-10-23",
  }), { coveredByClaim: false, reason: "EVIDENCE_NOT_REVIEWABLE" });
});

test("calendar claim comparison accepts matching claims from distinct source IDs only", () => {
  assert.deepEqual(compareSessionEvidenceClaims(session, {
    ...session, calendarSourceId: "fixture-independent-calendar",
  }), {
    consistent: true, indexKey: "nikkei", sessionDate: "2026-10-23", sessionClaim: "open",
  });
  assert.deepEqual(compareSessionEvidenceClaims(session, {
    ...session, verifierId: "different-reviewer",
  }), { consistent: false, reason: "NOT_INDEPENDENT_EVIDENCE" });
});

test("calendar claim comparison rejects conflicts and identity mismatches", () => {
  assert.deepEqual(compareSessionEvidenceClaims(session, {
    ...session, calendarSourceId: "other", sessionClaim: "closed",
  }), { consistent: false, reason: "SESSION_CLAIM_CONFLICT" });
  assert.deepEqual(compareSessionEvidenceClaims(session, {
    ...session, calendarSourceId: "other", sessionDate: "2026-10-22",
  }), { consistent: false, reason: "SESSION_IDENTITY_MISMATCH" });
  assert.deepEqual(compareSessionEvidenceClaims(session, {
    ...session, calendarSourceId: "other", indexKey: "topix",
  }), { consistent: false, reason: "SESSION_IDENTITY_MISMATCH" });
  assert.deepEqual(compareSessionEvidenceClaims(session, {
    ...session, calendarSourceId: "other", sessionDate: "2026-02-30",
  }), { consistent: false, reason: "EVIDENCE_NOT_REVIEWABLE" });
});

test("calendar comparison treats case and whitespace variants as one source", () => {
  for (const calendarSourceId of [
    "FIXTURE-CALENDAR",
    " fixture-calendar ",
    "\tFixture-Calendar\n",
  ]) {
    assert.deepEqual(compareSessionEvidenceClaims(session, {
      ...session, calendarSourceId, verifierId: "independent-reviewer",
      calendarVersion: "v2",
    }), { consistent: false, reason: "NOT_INDEPENDENT_EVIDENCE" });
  }
});

test("calendar comparison refuses invalid evidence even if claims agree", () => {
  assert.deepEqual(compareSessionEvidenceClaims({
    ...session, calendarSourceId: "",
  }, {
    ...session, calendarSourceId: "other",
  }), { consistent: false, reason: "EVIDENCE_NOT_REVIEWABLE" });
  assert.deepEqual(compareSessionEvidenceClaims(session, {
    ...session, calendarSourceId: "other", sessionClaim: "OPEN",
  }), { consistent: false, reason: "EVIDENCE_NOT_REVIEWABLE" });
});

test("claimed rights coverage includes both validity boundaries but not adjacent days", () => {
  for (const sessionDate of ["2026-01-01", "2026-12-31"]) {
    assert.deepEqual(assessClaimedRightsCoverage(rights, {
      indexKey: "nikkei", use: "internal_research", sessionDate,
    }), { coveredByClaim: true });
  }
  for (const sessionDate of ["2025-12-31", "2027-01-01"]) {
    assert.deepEqual(assessClaimedRightsCoverage(rights, {
      indexKey: "nikkei", use: "internal_research", sessionDate,
    }), { coveredByClaim: false, reason: "DATE_NOT_COVERED" });
  }
});

const bundle = {
  rights,
  calendarA: session,
  calendarB: { ...session, calendarSourceId: "fixture-independent-calendar" },
  request: { indexKey: "nikkei", use: "internal_research", sessionDate: "2026-10-23" },
};

test("synthetic bundle can be queued for manual review but is never authorized", () => {
  assert.deepEqual(assessResearchEvidenceBundle(bundle), {
    readyForManualReview: true, indexKey: "nikkei", sessionDate: "2026-10-23",
  });
});

test("bundle fails closed for revoked rights, unclaimed use and stale validity", () => {
  for (const rightsChange of [
    { revoked: true },
    { permittedUses: ["display"] },
    { validUntil: "2026-10-22" },
  ]) {
    const result = assessResearchEvidenceBundle({
      ...bundle, rights: { ...rights, ...rightsChange },
    });
    assert.equal(result.readyForManualReview, false);
    assert.match((result as { reason: string }).reason, /^RIGHTS_CLAIM_/);
  }
});

test("bundle rejects conflicting, closed and non-independent calendar claims", () => {
  for (const calendarB of [
    { ...session, calendarSourceId: "other", sessionClaim: "closed" },
    { ...session, calendarSourceId: "other", sessionClaim: "closed" },
    { ...session, calendarSourceId: " FIXTURE-CALENDAR " },
  ]) {
    assert.equal(assessResearchEvidenceBundle({ ...bundle, calendarB }).readyForManualReview, false);
  }
  assert.deepEqual(assessResearchEvidenceBundle({
    ...bundle,
    calendarA: { ...session, sessionClaim: "closed" },
    calendarB: { ...session, calendarSourceId: "other", sessionClaim: "closed" },
  }), { readyForManualReview: false, reason: "SESSION_NOT_CLAIMED_OPEN" });
});

test("bundle rejects request/calendar mismatch and malformed top-level input", () => {
  assert.deepEqual(assessResearchEvidenceBundle({
    ...bundle, request: { ...bundle.request, sessionDate: "2026-10-22" },
  }), { readyForManualReview: false, reason: "REQUEST_CALENDAR_MISMATCH" });
  assert.deepEqual(assessResearchEvidenceBundle(null as unknown as typeof bundle), {
    readyForManualReview: false, reason: "INVALID_BUNDLE",
  });
});

test("manual review summary never authorizes or enables persistence", () => {
  assert.deepEqual(summarizeResearchEvidenceForManualReview(bundle), {
    stage: "manual_review_candidate",
    indexKey: "nikkei",
    sessionDate: "2026-10-23",
    reasonCode: null,
    authorized: false,
    tradingSessionVerified: false,
    persistenceEnabled: false,
  });
});

test("blocked summary returns only a reason code and no candidate identity", () => {
  assert.deepEqual(summarizeResearchEvidenceForManualReview({
    ...bundle, rights: { ...rights, revoked: true },
  }), {
    stage: "blocked",
    indexKey: null,
    sessionDate: null,
    reasonCode: "RIGHTS_CLAIM_EVIDENCE_NOT_REVIEWABLE",
    authorized: false,
    tradingSessionVerified: false,
    persistenceEnabled: false,
  });
});

test("manual review summary excludes raw evidence and provider identifiers", () => {
  const summary = summarizeResearchEvidenceForManualReview(bundle);
  const serialized = JSON.stringify(summary);
  for (const sensitive of ["fixture-provider", "fixture-evidence", "fixture-verifier", "fixture-calendar"]) {
    assert.equal(serialized.includes(sensitive), false);
  }
});
