import type { FrozenRelativeObservation } from "./marketRelativePowerCohorts";

export type ReversalCandidate = FrozenRelativeObservation & {
  stockReturnPct: number;
  marketReturnPct: number;
};

/** Retrospective-only. A rebound is not a forward-looking buy signal. */
export function summarizeLowPowerReversals(rows: ReversalCandidate[], minRisePct = 5) {
  if (!Number.isFinite(minRisePct) || minRisePct <= 0 || minRisePct > 100)
    return { status: "invalid_threshold" as const };
  const seen = new Set<string>();
  const matched: ReversalCandidate[] = [];
  let eligible = 0;
  let rejected = 0;
  for (const row of rows) {
    const key = [row.stockCode, row.signalAt, row.fromDate, row.toDate, row.benchmark, row.window].join("|");
    const valid = Number.isFinite(row.aiPowerAtSignal) && row.aiPowerAtSignal >= 0 &&
      row.aiPowerAtSignal < 40 && /^\d{4}$/.test(row.stockCode) &&
      Number.isFinite(Date.parse(row.signalAt)) &&
      /^\d{4}-\d{2}-\d{2}$/.test(row.fromDate) &&
      /^\d{4}-\d{2}-\d{2}$/.test(row.toDate) &&
      row.toDate > row.fromDate &&
      ["nikkei", "topix"].includes(row.benchmark) &&
      ["daily_close", "intraday_0905"].includes(row.window) &&
      Number.isFinite(row.stockReturnPct) && Number.isFinite(row.marketReturnPct) &&
      Number.isFinite(row.excessReturnPoints) &&
      Math.abs(row.stockReturnPct - row.marketReturnPct - row.excessReturnPoints) < 1e-8;
    if (!valid || seen.has(key)) { rejected++; continue; }
    seen.add(key);
    eligible++;
    if (row.stockReturnPct >= minRisePct && row.excessReturnPoints > 0) matched.push(row);
  }
  return { status: "observed" as const, eligible, matchedCount: matched.length,
    matchedRatePct: eligible ? 100 * matched.length / eligible : null, rejected,
    matches: matched, note: "Past outcomes only; never infer predictive accuracy or a buy recommendation." };
}
