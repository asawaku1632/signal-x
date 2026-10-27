/**
 * STEP 381-400. Vendor due-diligence questions, NOT a list of licensed vendors.
 * No network requests, contract interpretation, procurement, or authorization.
 */
export type IndexKey = "nikkei" | "topix";
export type ProviderDueDiligence = {
  providerName: unknown;
  coveredIndices: unknown;
  dataRedistributionAllowed: unknown;
  retentionAllowed: unknown;
  commercialDisplayAllowed: unknown;
  derivedAnalyticsAllowed: unknown;
  automatedFetchAllowed: unknown;
  contractualEvidenceReference: unknown;
  exchangeCalendarSource: unknown;
  rateLimitDocumented: unknown;
};
export const PROVIDER_REVIEW_QUESTIONS = [
  { key: "dataRedistributionAllowed", label: "アプリ利用者への再配信・表示" },
  { key: "retentionAllowed", label: "履歴の保存と保持期間" },
  { key: "commercialDisplayAllowed", label: "有料アプリ内での表示" },
  { key: "derivedAnalyticsAllowed", label: "指数データを使った派生分析" },
  { key: "automatedFetchAllowed", label: "API・自動取得の可否" },
  { key: "rateLimitDocumented", label: "取得頻度とレート制限" },
] as const;
export type ProviderReviewResult = {
  status: "manual_contract_review_required";
  eligibleForProduction: false;
  evidenceAuthenticated: false;
  issues: string[];
  questions: typeof PROVIDER_REVIEW_QUESTIONS;
};
export function reviewProviderDraft(input: ProviderDueDiligence): ProviderReviewResult {
  const x = input && typeof input === "object" && !Array.isArray(input) ? input : {} as ProviderDueDiligence;
  const issues: string[] = [];
  if (typeof x.providerName !== "string" || !x.providerName.trim()) issues.push("PROVIDER_UNNAMED");
  if (!Array.isArray(x.coveredIndices) || x.coveredIndices.length !== 2 ||
      !x.coveredIndices.includes("nikkei") || !x.coveredIndices.includes("topix") ||
      x.coveredIndices.some(v => v !== "nikkei" && v !== "topix")) issues.push("INDEX_COVERAGE_UNCONFIRMED");
  for (const q of PROVIDER_REVIEW_QUESTIONS) {
    if (x[q.key] !== true) issues.push(q.key.toUpperCase() + "_UNCONFIRMED");
  }
  if (typeof x.contractualEvidenceReference !== "string" || !x.contractualEvidenceReference.trim())
    issues.push("CONTRACT_EVIDENCE_MISSING");
  if (typeof x.exchangeCalendarSource !== "string" || !x.exchangeCalendarSource.trim())
    issues.push("CALENDAR_SOURCE_MISSING");
  return {
    status: "manual_contract_review_required",
    eligibleForProduction: false,
    evidenceAuthenticated: false,
    issues,
    questions: PROVIDER_REVIEW_QUESTIONS,
  };
}
