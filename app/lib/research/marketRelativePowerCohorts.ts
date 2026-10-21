export type PowerCohort = "high_90_plus" | "middle_40_to_89" | "low_under_40";
export type FrozenRelativeObservation = {
  stockCode: string;
  aiPowerAtSignal: number;
  signalAt: string;
  fromDate: string;
  toDate: string;
  benchmark: "nikkei" | "topix";
  window: "daily_close" | "intraday_0905";
  excessReturnPoints: number;
};

export function powerCohort(score: number): PowerCohort | null {
  if (!Number.isFinite(score) || score < 0 || score > 100) return null;
  return score >= 90 ? "high_90_plus" : score >= 40 ? "middle_40_to_89" : "low_under_40";
}

/** Research-only summary: each stock+signal+window+benchmark is counted once. */
export function summarizePowerCohorts(rows: FrozenRelativeObservation[]) {
  const seen = new Set<string>();
  const groups = new Map<PowerCohort, number[]>([
    ["high_90_plus", []], ["middle_40_to_89", []], ["low_under_40", []],
  ]);
  let rejected = 0;
  for (const row of rows) {
    const cohort = powerCohort(row.aiPowerAtSignal);
    const signalTime = Date.parse(row.signalAt);
    const key = [row.stockCode, row.signalAt, row.fromDate, row.toDate, row.benchmark, row.window].join("|");
    if (!cohort || !/^\d{4}$/.test(row.stockCode) || !Number.isFinite(signalTime) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(row.fromDate) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(row.toDate) || row.toDate <= row.fromDate ||
        !["nikkei", "topix"].includes(row.benchmark) ||
        !["daily_close", "intraday_0905"].includes(row.window) ||
        !Number.isFinite(row.excessReturnPoints) || seen.has(key)) {
      rejected++;
      continue;
    }
    seen.add(key);
    groups.get(cohort)!.push(row.excessReturnPoints);
  }
  const summary = [...groups].map(([cohort, values]) => ({
    cohort,
    sampleSize: values.length,
    meanExcessReturnPoints: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null,
    outperformRatePct: values.length ? 100 * values.filter(v => v > 0).length / values.length : null,
  }));
  return { summary, accepted: seen.size, rejected, caveat: "Descriptive only: not predictive; compare matched dates, horizon and benchmark before interpreting." };
}
