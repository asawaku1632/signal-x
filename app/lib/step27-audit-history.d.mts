import type { AuditGroup } from "./step27-audit-comparison.mjs";
export declare function analyzeAuditHistory(history: Array<{ audited_at: string; details: AuditGroup[] | unknown }>): {
  snapshotCount: number;
  comparableTransitions: number;
  status: "INSUFFICIENT_HISTORY" | "REPEATED_ISSUES" | "NO_REPEATED_ISSUES_OBSERVED";
  repeated: Array<{ key: string; count: number }>;
  findings: Array<{ auditedAt: string; state: string; issues: Array<{ code: string; key: string | null }> }>;
  note: string;
};
