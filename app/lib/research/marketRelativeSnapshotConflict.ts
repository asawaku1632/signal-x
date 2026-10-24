import type { ProspectiveSnapshotInput } from "./marketRelativeProspectiveSnapshot";

export type StoredSnapshot = Record<string, unknown>;
export type SnapshotConflictDecision = "duplicate" | "conflict" | "missing";

export function classifySnapshotConflict(
  input: ProspectiveSnapshotInput,
  rows: StoredSnapshot[],
): SnapshotConflictDecision {
  if (rows.length !== 1) return rows.length === 0 ? "missing" : "conflict";
  const row = rows[0];
  const sameNumber = (value: unknown, expected: number) =>
    value !== null && value !== undefined && value !== "" &&
    Number.isFinite(Number(value)) && Number(value) === expected;
  const sameTime = (value: unknown, expected: string) => {
    const parsed = value instanceof Date ? value.getTime() : Date.parse(String(value));
    return Number.isFinite(parsed) && parsed === Date.parse(expected);
  };
  const same =
    row.signal_id === input.signalId &&
    row.code === input.code &&
    sameNumber(row.ai_power, input.aiPower) &&
    sameNumber(row.price, input.price) &&
    sameTime(row.price_observed_at, input.priceObservedAt) &&
    sameTime(row.signal_observed_at, input.signalObservedAt) &&
    sameTime(row.captured_at, input.capturedAt) &&
    row.source === input.source &&
    row.version === input.version;
  return same ? "duplicate" : "conflict";
}
