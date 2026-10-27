export type AuditGroup = { jst_date: string; index_key: string; saved_count: number };
export type AuditChange = { key: string; type: "ADDED" | "COUNT_CHANGED" | "MISSING"; before: number | null; after: number | null };
export declare function compareAuditGroups(previous: AuditGroup[], current: AuditGroup[]): {
  decision: "PASS" | "NO_DATA" | "DUPLICATE_DETECTED";
  duplicateGroups: number;
  status: "CHANGED" | "UNCHANGED";
  changes: AuditChange[];
};
