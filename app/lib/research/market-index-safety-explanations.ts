/**
 * STEP 521-540: explain read-only audit findings without exposing contract
 * text, email addresses, provider secrets or personally identifying data.
 * No authorization decisions are made here.
 */
import type { ResearchSafetyAudit } from "./market-index-safety-audit.ts";

const LABELS: Record<string, string> = {
  INDEX_SCOPE_MISMATCH: "指数の対象範囲が一致しません",
  PROVIDER_SCOPE_MISMATCH: "データ提供元が一致しません",
  MANUAL_REVIEW_IS_NOT_AUTHORIZATION: "手動確認候補は正式な利用許諾ではありません",
  SELF_ATTESTED_LICENSE_IS_NOT_AUTHORIZATION: "自己申告の契約条件は正式な許諾証拠ではありません",
  CONNECTION_INVALID_INDEX: "接続対象の指数が未確認です",
  CONNECTION_UNVERIFIED_PROVIDER: "正規の提供元が未確認です",
  CONNECTION_LICENSE: "契約証拠の独立確認が必要です",
  CONNECTION_CALENDAR: "取引日カレンダーの確認が必要です",
  CONNECTION_FEED: "正規データ取得元が未接続です",
  CONNECTION_QUALITY: "指数データの品質確認が必要です",
  CONNECTION_RETENTION: "データ保存条件が未確認です",
  CONNECTION_REDISTRIBUTION: "第三者提供の条件が未確認です",
  CONNECTION_APPROVAL: "運用責任者の承認が未確認です",
};
export type SafetyFindingSummary = {
  mode: "research_only";
  decision: "blocked";
  actionsEnabled: false;
  total: number;
  entries: { code: string; description: string; category: "connection" | "license" | "scope" | "other" }[];
};
export function explainResearchSafetyFindings(input: ResearchSafetyAudit): SafetyFindingSummary {
  const findings = input && typeof input === "object" && Array.isArray(input.findings)
    ? input.findings : [];
  const entries = [...new Set(findings.filter((x): x is string =>
    typeof x === "string" && /^[A-Z][A-Z0-9_]{0,99}$/.test(x)))].sort().slice(0, 100).map(code => ({
    code,
    description: LABELS[code] ?? (code.startsWith("LICENSE_")
      ? "契約・利用範囲の確認が必要です" : "研究用の追加確認が必要です"),
    category: (code.startsWith("CONNECTION_") ? "connection" :
      code.startsWith("LICENSE_") ? "license" :
      code.endsWith("_MISMATCH") ? "scope" : "other") as "connection" | "license" | "scope" | "other",
  }));
  return { mode: "research_only", decision: "blocked", actionsEnabled: false, total: entries.length, entries };
}
