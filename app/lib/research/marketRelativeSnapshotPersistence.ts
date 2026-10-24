import { buildSnapshotInsertPlan } from "./marketRelativeSnapshotInsertPlan";
import { classifySnapshotConflict } from "./marketRelativeSnapshotConflict";
import type { ProspectiveSnapshotInput } from "./marketRelativeProspectiveSnapshot";

export type SnapshotStorage = {
  query(sql: string, params: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
};

export type SnapshotPersistResult =
  | { status: "inserted" | "duplicate" }
  | { status: "rejected" | "conflict"; reasons: string[] };

/** Research-only. No database connection, endpoint, cron or live ingestion is created here. */
export async function persistResearchSnapshot(
  storage: SnapshotStorage,
  input: ProspectiveSnapshotInput,
): Promise<SnapshotPersistResult> {
  const plan = buildSnapshotInsertPlan(input);
  if (!plan.ok) return { status: "rejected", reasons: plan.errors };
  const result = await storage.query(plan.sql, plan.params);
  if (result.rows.length === 1) return { status: "inserted" };
  if (result.rows.length !== 0) return { status: "conflict", reasons: ["unexpected_insert_result"] };
  const found = await storage.query(
    "SELECT signal_id,code,ai_power,price,price_observed_at,signal_observed_at,captured_at,source,version FROM public.market_relative_prospective_ledger WHERE signal_id=$1",
    [input.signalId],
  );
  const decision = classifySnapshotConflict(input, found.rows);
  return decision === "duplicate"
    ? { status: "duplicate" }
    : { status: "conflict", reasons: [decision === "missing" ? "missing_after_conflict" : "immutable_signal_conflict"] };
}
