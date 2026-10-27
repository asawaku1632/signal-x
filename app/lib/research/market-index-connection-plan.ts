/**
 * STEP 481-500: research-only connection planning contract.
 * Never call this a license verifier. All inputs are untrusted assertions.
 * This module performs no network calls, database writes, or scheduling.
 */
export type IndexConnectionPlanInput = {
  indexKey: unknown;
  providerId: unknown;
  authenticatedLicense: unknown;
  authenticatedCalendar: unknown;
  licensedFeedConfigured: unknown;
  validatedObservation: unknown;
  retentionScopeConfirmed: unknown;
  redistributionScopeConfirmed: unknown;
  operatorApproval: unknown;
};
export const CONNECTION_CHECKS = [
  { key: "authenticatedLicense", code: "LICENSE", label: "契約証拠の独立確認" },
  { key: "authenticatedCalendar", code: "CALENDAR", label: "取引日カレンダーの確認" },
  { key: "licensedFeedConfigured", code: "FEED", label: "正規データ取得元の設定" },
  { key: "validatedObservation", code: "QUALITY", label: "実データの品質確認" },
  { key: "retentionScopeConfirmed", code: "RETENTION", label: "保存・保持条件の確認" },
  { key: "redistributionScopeConfirmed", code: "REDISTRIBUTION", label: "第三者提供条件の確認" },
  { key: "operatorApproval", code: "APPROVAL", label: "運用責任者の明示的承認" },
] as const;
export function buildIndexConnectionPlan(input: IndexConnectionPlanInput): {
  mode: "research_only";
  readiness: "blocked" | "manual_review_candidate";
  allowNetworkFetch: false;
  allowDatabaseWrite: false;
  allowCron: false;
  allowProductionIntegration: false;
  blockers: string[];
} {
  const x = input && typeof input === "object" && !Array.isArray(input) ? input : {} as IndexConnectionPlanInput;
  const blockers: string[] = [];
  if (x.indexKey !== "nikkei" && x.indexKey !== "topix") blockers.push("INVALID_INDEX");
  if (typeof x.providerId !== "string" || !x.providerId.trim() ||
      x.providerId.trim().toLowerCase() === "licensed-provider-pending") blockers.push("UNVERIFIED_PROVIDER");
  for (const check of CONNECTION_CHECKS) {
    if (x[check.key] !== true) blockers.push(check.code);
  }
  return {
    mode: "research_only",
    readiness: blockers.length ? "blocked" : "manual_review_candidate",
    allowNetworkFetch: false,
    allowDatabaseWrite: false,
    allowCron: false,
    allowProductionIntegration: false,
    blockers,
  };
}
