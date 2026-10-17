/** Isolated research-only daily-close ledger simulator.
 * Pure functions: no Supabase, production data, Cron, LINE or trade effects.
 * Price values are never silently overwritten. Corporate actions are NOT normalized here.
 */
export type ResearchDailyClose = Readonly<{
  code: string;
  dateJst: string;
  close: number;
  source: "YAHOO_CHART_UNADJUSTED";
}>;
export type ResearchDailyMerge = Readonly<{
  rows: ResearchDailyClose[];
  inserted: number;
  unchanged: number;
  conflicts: ReadonlyArray<{ key: string; existing: number; incoming: number }>;
}>;
const keyOf = (row: ResearchDailyClose) => row.code + ":" + row.dateJst;
function validate(row: ResearchDailyClose): void {
  if (!/^\d{4}$/.test(row.code) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(row.dateJst) ||
      !Number.isFinite(Date.parse(row.dateJst + "T00:00:00Z")) ||
      new Date(row.dateJst + "T00:00:00Z").toISOString().slice(0, 10) !== row.dateJst ||
      typeof row.close !== "number" || !Number.isFinite(row.close) || row.close <= 0 ||
      row.source !== "YAHOO_CHART_UNADJUSTED") {
    throw Error("INVALID_RESEARCH_DAILY_CLOSE");
  }
}
export function mergeResearchDailyCloses(
  existing: readonly ResearchDailyClose[],
  incoming: readonly ResearchDailyClose[],
): ResearchDailyMerge {
  const byKey = new Map<string, ResearchDailyClose>();
  for (const row of existing) {
    validate(row);
    const key = keyOf(row);
    if (byKey.has(key)) throw Error("DUPLICATE_EXISTING_DAILY_CLOSE");
    byKey.set(key, { ...row });
  }
  let inserted = 0, unchanged = 0;
  const conflicts: { key: string; existing: number; incoming: number }[] = [];
  for (const row of incoming) {
    validate(row);
    const key = keyOf(row);
    const previous = byKey.get(key);
    if (!previous) {
      byKey.set(key, { ...row });
      inserted++;
    } else if (previous.close === row.close && previous.source === row.source) {
      unchanged++;
    } else {
      conflicts.push({ key, existing: previous.close, incoming: row.close });
    }
  }
  return {
    rows: [...byKey.values()].sort((a, b) =>
      a.dateJst.localeCompare(b.dateJst) || a.code.localeCompare(b.code)),
    inserted, unchanged, conflicts,
  };
}
/** Deterministic contract tests; run manually in isolation before enabling any storage. */
export function verifyResearchDailyMergeContract(): boolean {
  const a: ResearchDailyClose = { code: "9984", dateJst: "2026-10-16", close: 4944, source: "YAHOO_CHART_UNADJUSTED" };
  const b: ResearchDailyClose = { ...a, dateJst: "2026-10-19", close: 5000 };
  const changed: ResearchDailyClose = { ...a, close: 4900 };
  const first = mergeResearchDailyCloses([], [a]);
  const repeat = mergeResearchDailyCloses(first.rows, [a]);
  const next = mergeResearchDailyCloses(repeat.rows, [b]);
  const conflict = mergeResearchDailyCloses(next.rows, [changed]);
  const batchDuplicate = mergeResearchDailyCloses([], [a, a]);
  return first.inserted === 1 && first.rows.length === 1 &&
    repeat.inserted === 0 && repeat.unchanged === 1 && repeat.rows.length === 1 &&
    next.inserted === 1 && next.rows.length === 2 &&
    conflict.inserted === 0 && conflict.conflicts.length === 1 &&
    conflict.rows.find(row => row.dateJst === a.dateJst)?.close === 4944 &&
    batchDuplicate.inserted === 1 && batchDuplicate.unchanged === 1 &&
    batchDuplicate.rows.length === 1;
}
