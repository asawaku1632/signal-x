/**
 * STEP 40-45: research-only, fail-closed eligibility contract.
 * This module does not query a provider, write to a DB or activate a scheduler.
 * A rights flag alone is never sufficient: documented evidence and an
 * exchange-session calendar verdict must both be provided by trusted code.
 */
export type FinalizationCandidate = {
  indexKey: unknown;
  sessionDate: unknown;
  sourceRunId: unknown;
  providerId: unknown;
  providerRightsVerified: unknown;
  rightsEvidenceId: unknown;
  status: unknown;
  observedAt: unknown;
  value: unknown;
  exchangeSessionVerified: unknown;
};

export type FinalizationVerdict =
  | { eligible: true; key: string }
  | { eligible: false; reason: string };

export function checkFinalizationEligibility(c: FinalizationCandidate): FinalizationVerdict {
  if (!c || typeof c !== "object" || Array.isArray(c))
    return { eligible: false, reason: "INVALID_CANDIDATE" };
  if (c.indexKey !== "nikkei" && c.indexKey !== "topix")
    return { eligible: false, reason: "INVALID_INDEX" };
  if (c.providerRightsVerified !== true ||
      typeof c.rightsEvidenceId !== "string" || !c.rightsEvidenceId.trim())
    return { eligible: false, reason: "PROVIDER_RIGHTS_UNVERIFIED" };
  if (c.exchangeSessionVerified !== true ||
      typeof c.sessionDate !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(c.sessionDate) ||
      !Number.isFinite(Date.parse(c.sessionDate + "T00:00:00Z")) ||
      new Date(c.sessionDate + "T00:00:00Z").toISOString().slice(0, 10) !== c.sessionDate)
    return { eligible: false, reason: "SESSION_UNVERIFIED" };
  if (c.status !== "available" || typeof c.value !== "number" ||
      !Number.isFinite(c.value) || c.value <= 0)
    return { eligible: false, reason: "OBSERVATION_UNAVAILABLE" };
  if (typeof c.observedAt !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T/.test(c.observedAt) ||
      !Number.isFinite(Date.parse(c.observedAt)) ||
      !/(Z|[+-]\d{2}:\d{2})$/.test(c.observedAt))
    return { eligible: false, reason: "TIMESTAMP_UNVERIFIED" };
  const observedDay = c.observedAt.slice(0, 10);
  if (!Number.isFinite(Date.parse(observedDay + "T00:00:00Z")) ||
      new Date(observedDay + "T00:00:00Z").toISOString().slice(0, 10) !== observedDay)
    return { eligible: false, reason: "TIMESTAMP_UNVERIFIED" };
  if (typeof c.sourceRunId !== "string" || !c.sourceRunId.trim() ||
      typeof c.providerId !== "string" || !c.providerId.trim() ||
      c.providerId.trim() === "licensed-provider-pending")
    return { eligible: false, reason: "SOURCE_UNVERIFIED" };
  return { eligible: true, key: c.indexKey + ":" + c.sessionDate };
}
