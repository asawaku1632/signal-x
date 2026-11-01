/**
 * Descriptive research audit only. Does not infer trading edge or modify DB.
 * Count missing comparisons explicitly; never treat missing data as zero return.
 */
export function summarizeMmOutcomeShadow(report, { tolerancePct = 0.01 } = {}) {
  if (!report || report.status !== "RESEARCH_ONLY" || !Array.isArray(report.rows) ||
      typeof tolerancePct !== "number" || !Number.isFinite(tolerancePct) || tolerancePct < 0) {
    return { status: "BLOCKED", reason: "INVALID_OR_UNVERIFIED_REPORT" };
  }
  const horizons = {};
  for (const h of [1, 3, 5]) {
    const summary = {
      observations: report.rows.length, comparable: 0, changed: 0, unchanged: 0,
      missingStored: 0, pending: 0, missingStock: 0, missingBenchmark: 0,
      otherBlocked: 0, meanDeltaPct: null, maxAbsDeltaPct: null,
      benchmarked: 0,
    };
    let deltaSum = 0;
    let maxAbsDelta = 0;
    for (const row of report.rows) {
      const item = row?.horizons?.[h];
      if (!item) { summary.otherBlocked++; continue; }
      if (item.status === "PENDING") { summary.pending++; continue; }
      if (item.status === "MISSING_STOCK_CLOSE") { summary.missingStock++; continue; }
      if (!["READY", "STOCK_ONLY"].includes(item.status)) {
        summary.otherBlocked++; continue;
      }
      if (item.status === "STOCK_ONLY") summary.missingBenchmark++;
      else summary.benchmarked++;
      if (typeof item.storedReturn !== "number" || !Number.isFinite(item.storedReturn) ||
          typeof item.delta !== "number" || !Number.isFinite(item.delta)) {
        summary.missingStored++; continue;
      }
      summary.comparable++;
      deltaSum += item.delta;
      maxAbsDelta = Math.max(maxAbsDelta, Math.abs(item.delta));
      if (Math.abs(item.delta) > tolerancePct) summary.changed++;
      else summary.unchanged++;
    }
    if (summary.comparable) {
      summary.meanDeltaPct = deltaSum / summary.comparable;
      summary.maxAbsDeltaPct = maxAbsDelta;
    }
    horizons[h] = summary;
  }
  return { status: "RESEARCH_ONLY", tolerancePct, horizons,
    notificationEligible: false, historicalDataModified: false };
}
