/**
 * STEP 501-520: pure, read-only safety audit for claimed connection states.
 * This is not an authorization gate. No external calls, storage or scheduler.
 */
import { buildIndexConnectionPlan } from "./market-index-connection-plan.ts";
import { assessLicenseResponseDraft } from "./market-index-license-response.ts";

export type ResearchSafetyAudit = {
  mode: "research_only";
  state: "blocked";
  mayFetch: false;
  mayPersist: false;
  maySchedule: false;
  mayUseInProduction: false;
  findings: string[];
};
export function auditIndexResearchSafety(input: {
  connection: Parameters<typeof buildIndexConnectionPlan>[0];
  license: Parameters<typeof assessLicenseResponseDraft>[0];
}): ResearchSafetyAudit {
  const obj = input && typeof input === "object" && !Array.isArray(input) ? input : {} as typeof input;
  const plan = buildIndexConnectionPlan(obj.connection);
  const response = assessLicenseResponseDraft(obj.license);
  const findings = [...plan.blockers.map(x => "CONNECTION_" + x),
    ...response.missingOrUnverified.map(x => "LICENSE_" + x)];
  if (plan.readiness === "manual_review_candidate") findings.push("MANUAL_REVIEW_IS_NOT_AUTHORIZATION");
  if (response.missingOrUnverified.length === 0) findings.push("SELF_ATTESTED_LICENSE_IS_NOT_AUTHORIZATION");
  if (obj.connection && obj.license &&
      obj.connection.indexKey !== obj.license.indexKey) findings.push("INDEX_SCOPE_MISMATCH");
  if (obj.connection && obj.license &&
      obj.connection.providerId !== obj.license.providerId) findings.push("PROVIDER_SCOPE_MISMATCH");
  return {
    mode: "research_only",
    state: "blocked",
    mayFetch: false,
    mayPersist: false,
    maySchedule: false,
    mayUseInProduction: false,
    findings: [...new Set(findings)].sort(),
  };
}
