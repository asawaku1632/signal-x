export type AuditGroup = { jst_date: string; index_key: string; saved_count: number };
export type AuditChange = { key: string; type: "ADDED" | "COUNT_CHANGED" | "MISSING"; before: number | null; after: number | null };
export declare function compareAuditGroups(previous: AuditGroup[], current: AuditGroup[]): {
  decision: "PASS" | "NO_DATA" | "DUPLICATE_DETECTED";
  duplicateGroups: number;
  status: "CHANGED" | "UNCHANGED";
  changes: AuditChange[];
};

export type AuditInvestigationItem = { code: string; key?: string; action: string };
export declare function classifyAuditInvestigation(comparison: { changes: AuditChange[] } | null, current: AuditGroup[]): {
  state: "NO_DATA" | "INVESTIGATE" | "NO_BASELINE" | "REVIEW_CHANGES" | "STABLE";
  items: AuditInvestigationItem[];
};
