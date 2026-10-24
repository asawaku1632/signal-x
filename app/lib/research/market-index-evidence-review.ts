/**
 * Research-only evidence intake. No provider calls, DB writes, authorization,
 * or exchange calendar lookup. A passing shape check is NOT proof of rights.
 */
export type RightsEvidenceDraft = {
  providerId: unknown;
  evidenceId: unknown;
  verifierId: unknown;
  allowedIndices: unknown;
  permittedUses: unknown;
  validFrom: unknown;
  validUntil: unknown;
  revoked: unknown;
};

export type EvidenceReview =
  | { reviewable: true; providerId: string; evidenceId: string }
  | { reviewable: false; reason: string };

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
function validDay(x: unknown): x is string {
  return typeof x === "string" && ISO_DAY.test(x) &&
    Number.isFinite(Date.parse(x + "T00:00:00Z")) &&
    new Date(x + "T00:00:00Z").toISOString().slice(0, 10) === x;
}

export function assessRightsEvidenceDraft(d: RightsEvidenceDraft): EvidenceReview {
  if (!d || typeof d !== "object" || Array.isArray(d))
    return { reviewable: false, reason: "INVALID_EVIDENCE" };
  if (typeof d.providerId !== "string" || !d.providerId.trim() ||
      d.providerId.trim().toLowerCase() === "licensed-provider-pending" ||
      typeof d.evidenceId !== "string" || !d.evidenceId.trim() ||
      typeof d.verifierId !== "string" || !d.verifierId.trim())
    return { reviewable: false, reason: "MISSING_PROVENANCE" };
  if (!Array.isArray(d.allowedIndices) || d.allowedIndices.length === 0 ||
      !d.allowedIndices.every(x => x === "nikkei" || x === "topix") ||
      new Set(d.allowedIndices).size !== d.allowedIndices.length)
    return { reviewable: false, reason: "INVALID_INDEX_SCOPE" };
  if (!Array.isArray(d.permittedUses) || d.permittedUses.length === 0 ||
      !d.permittedUses.every(x => x === "internal_research" || x === "retain" || x === "display") ||
      new Set(d.permittedUses).size !== d.permittedUses.length)
    return { reviewable: false, reason: "INVALID_USE_SCOPE" };
  if (!validDay(d.validFrom) || !validDay(d.validUntil) || d.validFrom > d.validUntil)
    return { reviewable: false, reason: "INVALID_VALIDITY" };
  if (d.revoked !== false)
    return { reviewable: false, reason: "REVOCATION_NOT_CLEARED" };
  return { reviewable: true, providerId: d.providerId.trim(), evidenceId: d.evidenceId.trim() };
}

/**
 * Research-only calendar evidence intake. Does not know exchange holidays.
 * sessionClaim is only a claim; reviewable NEVER means trading-day verified.
 */
export type SessionEvidenceDraft = {
  indexKey: unknown;
  sessionDate: unknown;
  calendarSourceId: unknown;
  calendarVersion: unknown;
  verifierId: unknown;
  sessionClaim: unknown;
};
export function assessSessionEvidenceDraft(d: SessionEvidenceDraft):
  { reviewable: true; indexKey: string; sessionDate: string } |
  { reviewable: false; reason: string } {
  if (!d || typeof d !== "object" || Array.isArray(d))
    return { reviewable: false, reason: "INVALID_SESSION_EVIDENCE" };
  if (d.indexKey !== "nikkei" && d.indexKey !== "topix")
    return { reviewable: false, reason: "INVALID_INDEX" };
  if (!validDay(d.sessionDate))
    return { reviewable: false, reason: "INVALID_DATE" };
  if ([d.calendarSourceId, d.calendarVersion, d.verifierId].some(
    x => typeof x !== "string" || !x.trim()))
    return { reviewable: false, reason: "MISSING_CALENDAR_PROVENANCE" };
  if (d.sessionClaim !== "open" && d.sessionClaim !== "closed")
    return { reviewable: false, reason: "INVALID_SESSION_CLAIM" };
  return { reviewable: true, indexKey: d.indexKey, sessionDate: d.sessionDate };
}

/**
 * Checks whether a syntactically reviewable rights draft CLAIMS to cover a
 * requested index/use/date. This is NOT an authorization or license verifier.
 * The caller must independently authenticate the provider, evidence, and scope.
 */
export function assessClaimedRightsCoverage(
  d: RightsEvidenceDraft,
  request: { indexKey: unknown; use: unknown; sessionDate: unknown },
): { coveredByClaim: true } | { coveredByClaim: false; reason: string } {
  if (!assessRightsEvidenceDraft(d).reviewable)
    return { coveredByClaim: false, reason: "EVIDENCE_NOT_REVIEWABLE" };
  if (!request || typeof request !== "object" || Array.isArray(request))
    return { coveredByClaim: false, reason: "INVALID_REQUEST" };
  if (request.indexKey !== "nikkei" && request.indexKey !== "topix")
    return { coveredByClaim: false, reason: "INVALID_REQUEST_INDEX" };
  if (request.use !== "internal_research" && request.use !== "retain" && request.use !== "display")
    return { coveredByClaim: false, reason: "INVALID_REQUEST_USE" };
  if (!validDay(request.sessionDate))
    return { coveredByClaim: false, reason: "INVALID_REQUEST_DATE" };
  if (!(d.allowedIndices as string[]).includes(request.indexKey))
    return { coveredByClaim: false, reason: "INDEX_NOT_COVERED" };
  if (!(d.permittedUses as string[]).includes(request.use))
    return { coveredByClaim: false, reason: "USE_NOT_COVERED" };
  if (request.sessionDate < (d.validFrom as string) || request.sessionDate > (d.validUntil as string))
    return { coveredByClaim: false, reason: "DATE_NOT_COVERED" };
  return { coveredByClaim: true };
}

/**
 * Compare two syntactically reviewable calendar claims. This does not verify
 * exchange holidays, authenticate a calendar provider, or authorize storage.
 * Any disagreement fails closed for the purposes of manual research review.
 */
export function compareSessionEvidenceClaims(
  a: SessionEvidenceDraft,
  b: SessionEvidenceDraft,
): { consistent: true; indexKey: string; sessionDate: string; sessionClaim: "open" | "closed" } |
   { consistent: false; reason: string } {
  const first = assessSessionEvidenceDraft(a);
  const second = assessSessionEvidenceDraft(b);
  if (!first.reviewable || !second.reviewable)
    return { consistent: false, reason: "EVIDENCE_NOT_REVIEWABLE" };
  if (first.indexKey !== second.indexKey || first.sessionDate !== second.sessionDate)
    return { consistent: false, reason: "SESSION_IDENTITY_MISMATCH" };
  if (a.calendarSourceId === b.calendarSourceId)
    return { consistent: false, reason: "NOT_INDEPENDENT_EVIDENCE" };
  if (a.sessionClaim !== b.sessionClaim)
    return { consistent: false, reason: "SESSION_CLAIM_CONFLICT" };
  return {
    consistent: true,
    indexKey: first.indexKey,
    sessionDate: first.sessionDate,
    sessionClaim: a.sessionClaim as "open" | "closed",
  };
}
