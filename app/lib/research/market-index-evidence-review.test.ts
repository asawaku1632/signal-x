import test from "node:test";
import assert from "node:assert/strict";
import {
  assessRightsEvidenceDraft,
  assessSessionEvidenceDraft,
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
