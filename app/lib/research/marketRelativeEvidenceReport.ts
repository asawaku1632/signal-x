import { validateHistoricalEvidence, type HistoricalEvidence } from "./marketRelativeEvidenceGate";

export type EvidenceReportRow = HistoricalEvidence & { horizonTradingDays: number; window: "daily_close" | "intraday_0905" };

/** No DB access, no data backfill. Validates and reports every submitted observation. */
export function buildEvidenceReport(rows: EvidenceReportRow[]) {
  const eligible: EvidenceReportRow[] = [];
  const exclusions: { signalId: string; reasons: string[] }[] = [];
  const reasonCounts: Record<string, number> = {};
  const seen = new Set<string>();
  for (const row of rows) {
    const { reasons } = validateHistoricalEvidence(row);
    if (!Number.isInteger(row.horizonTradingDays) || row.horizonTradingDays < 1)
      reasons.push("invalid_horizon");
    if (!["daily_close", "intraday_0905"].includes(row.window))
      reasons.push("invalid_window");
    const key = [row.signalId, row.benchmark, row.window, row.horizonTradingDays].join("|");
    if (seen.has(key)) reasons.push("duplicate_signal");
    if (!reasons.length) { seen.add(key); eligible.push(row); }
    else {
      exclusions.push({ signalId: row.signalId, reasons });
      for (const reason of reasons) reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
    }
  }
  return { total: rows.length, eligibleCount: eligible.length, excludedCount: exclusions.length,
    eligible, exclusions, reasonCounts,
    caveat: "This validates submitted evidence only; it does not prove completeness of the upstream universe." };
}
