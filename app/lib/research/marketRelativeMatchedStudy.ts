export type MatchedStudyRow = {
  signalId: string;
  stockCode: string;
  aiPowerAtSignal: number;
  benchmark: "nikkei" | "topix";
  window: "daily_close" | "intraday_0905";
  horizonTradingDays: number;
  fromDate: string;
  toDate: string;
  excessReturnPoints: number;
};

/** Separate horizons, benchmark, and observation conventions before aggregating. */
export function summarizeMatchedRelativeStudy(rows: MatchedStudyRow[]) {
  const seen = new Set<string>();
  const buckets = new Map<string, { benchmark: string; window: string; horizonTradingDays: number; cohort: string; returns: number[] }>();
  let rejected = 0;
  for (const row of rows) {
    const cohort = Number.isFinite(row.aiPowerAtSignal) && row.aiPowerAtSignal >= 0 && row.aiPowerAtSignal <= 100
      ? row.aiPowerAtSignal >= 90 ? "high_90_plus" : row.aiPowerAtSignal < 40 ? "low_under_40" : "middle_40_to_89"
      : null;
    if (!row.signalId?.trim() || !/^\d{4}$/.test(row.stockCode) || !cohort ||
        !["nikkei", "topix"].includes(row.benchmark) ||
        !["daily_close", "intraday_0905"].includes(row.window) ||
        !Number.isInteger(row.horizonTradingDays) || row.horizonTradingDays < 1 ||
        !/^\d{4}-\d{2}-\d{2}$/.test(row.fromDate) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(row.toDate) || row.toDate <= row.fromDate ||
        !Number.isFinite(row.excessReturnPoints) || seen.has(row.signalId + "|" + row.benchmark + "|" + row.window + "|" + row.horizonTradingDays)) {
      rejected++;
      continue;
    }
    seen.add(row.signalId + "|" + row.benchmark + "|" + row.window + "|" + row.horizonTradingDays);
    const key = [row.benchmark, row.window, row.horizonTradingDays, cohort].join("|");
    if (!buckets.has(key)) buckets.set(key, { benchmark: row.benchmark, window: row.window, horizonTradingDays: row.horizonTradingDays, cohort, returns: [] });
    buckets.get(key)!.returns.push(row.excessReturnPoints);
  }
  const groups = [...buckets.values()].map(({ returns, ...group }) => ({
    ...group,
    sampleSize: returns.length,
    meanExcessReturnPoints: returns.reduce((a, b) => a + b, 0) / returns.length,
    medianExcessReturnPoints: (() => { const sorted = [...returns].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2; })(),
    outperformRatePct: 100 * returns.filter(value => value > 0).length / returns.length,
  }));
  return { groups, accepted: seen.size, rejected, caveat: "Descriptive only; verify the input horizon and original price timestamps upstream." };
}
