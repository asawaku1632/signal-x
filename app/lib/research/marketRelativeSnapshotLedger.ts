import { validateProspectiveSnapshot, type ProspectiveSnapshotInput } from "./marketRelativeProspectiveSnapshot";

export type LedgerRecord = Readonly<ProspectiveSnapshotInput>;
export type LedgerWriteResult =
  | { status: "inserted"; record: LedgerRecord }
  | { status: "duplicate"; record: LedgerRecord }
  | { status: "conflict" | "rejected"; reasons: string[] };

const same = (a: LedgerRecord, b: ProspectiveSnapshotInput) =>
  a.signalId === b.signalId && a.code === b.code &&
  a.aiPower === b.aiPower && a.price === b.price &&
  a.priceObservedAt === b.priceObservedAt &&
  a.signalObservedAt === b.signalObservedAt &&
  a.capturedAt === b.capturedAt && a.source === b.source && a.version === b.version;

/** Pure in-memory research contract. No DB writes, cron, or production integration. */
export function createSnapshotLedger() {
  const records = new Map<string, LedgerRecord>();
  return {
    write(input: ProspectiveSnapshotInput): LedgerWriteResult {
      const reasons = validateProspectiveSnapshot(input);
      if (reasons.length) return { status: "rejected", reasons };
      const existing = records.get(input.signalId);
      if (existing) {
        return same(existing, input)
          ? { status: "duplicate", record: existing }
          : { status: "conflict", reasons: ["immutable_signal_conflict"] };
      }
      const record = Object.freeze({ ...input });
      records.set(input.signalId, record);
      return { status: "inserted", record };
    },
    get(signalId: string): LedgerRecord | undefined { return records.get(signalId); },
    count(): number { return records.size; },
  };
}
