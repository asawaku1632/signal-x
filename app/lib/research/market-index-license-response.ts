/**
 * STEP 461-480: local-only intake of claimed license response fields.
 * NEVER store emails, attachments, personal details or actual contracts here.
 * Passing shape checks is NOT evidence authentication or permission to ingest.
 */
export type LicenseResponseDraft = {
  indexKey: unknown;
  providerId: unknown;
  contractReference: unknown;
  verifiedSigner: unknown;
  rightsForDisplay: unknown;
  rightsForAutomatedProcessing: unknown;
  rightsForRetention: unknown;
  rightsForRedistribution: unknown;
  rightsForPaidUsers: unknown;
  effectiveFrom: unknown;
  effectiveUntil: unknown;
  revocationChecked: unknown;
};
export const LICENSE_RESPONSE_FIELDS = [
  { key: "rightsForDisplay", label: "アプリ内の表示" },
  { key: "rightsForAutomatedProcessing", label: "自動処理・派生分析" },
  { key: "rightsForRetention", label: "履歴保存" },
  { key: "rightsForRedistribution", label: "第三者への配信" },
  { key: "rightsForPaidUsers", label: "有料ユーザー向け利用" },
] as const;
const day = (x: unknown): x is string =>
  typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x) &&
  !Number.isNaN(Date.parse(x + "T00:00:00Z")) &&
  new Date(x + "T00:00:00Z").toISOString().slice(0, 10) === x;
export function assessLicenseResponseDraft(input: LicenseResponseDraft): {
  status: "manual_review_only";
  authenticated: false;
  authorizedForProduction: false;
  missingOrUnverified: string[];
} {
  const x = input && typeof input === "object" && !Array.isArray(input) ? input : {} as LicenseResponseDraft;
  const missingOrUnverified: string[] = [];
  if (x.indexKey !== "nikkei" && x.indexKey !== "topix") missingOrUnverified.push("INDEX_UNCONFIRMED");
  if (typeof x.providerId !== "string" || !x.providerId.trim() ||
      x.providerId.trim().toLowerCase() === "licensed-provider-pending")
    missingOrUnverified.push("PROVIDER_UNCONFIRMED");
  if (typeof x.contractReference !== "string" || !x.contractReference.trim())
    missingOrUnverified.push("CONTRACT_UNCONFIRMED");
  if (x.verifiedSigner !== true) missingOrUnverified.push("SIGNER_UNVERIFIED");
  for (const f of LICENSE_RESPONSE_FIELDS) {
    if (x[f.key] !== true) missingOrUnverified.push(f.key.toUpperCase() + "_UNCONFIRMED");
  }
  if (!day(x.effectiveFrom) || !day(x.effectiveUntil) || x.effectiveFrom > x.effectiveUntil)
    missingOrUnverified.push("CONTRACT_DATES_UNCONFIRMED");
  if (x.revocationChecked !== true) missingOrUnverified.push("REVOCATION_UNVERIFIED");
  return {
    status: "manual_review_only",
    authenticated: false,
    authorizedForProduction: false,
    missingOrUnverified,
  };
}
