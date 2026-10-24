export type FrozenOutcome = {
  stockCode: string;
  aiPowerAtSignal: number;
  signalAt: string;
  fromDate: string;
  toDate: string;
  benchmark: "nikkei" | "topix";
  window: "daily_close" | "intraday_0905";
  stockReturnPct: number;
  marketReturnPct: number;
  excessReturnPoints: number;
};

export function summarizeRatingSurprises(rows: FrozenOutcome[], thresholdPct = 5) {
  if (!Number.isFinite(thresholdPct) || thresholdPct <= 0 || thresholdPct > 100)
    return { status: "invalid_threshold" as const };
  const seen = new Set<string>();
  const lowScoreRallies: FrozenOutcome[] = [];
  const highScoreFalls: FrozenOutcome[] = [];
  let eligibleLow = 0, eligibleHigh = 0, rejected = 0;
  for (const row of rows) {
    const key = [row.stockCode, row.signalAt, row.fromDate, row.toDate, row.benchmark, row.window].join("|");
    const valid = /^\d{4}$/.test(row.stockCode) &&
      Number.isFinite(row.aiPowerAtSignal) && row.aiPowerAtSignal >= 0 && row.aiPowerAtSignal <= 100 &&
      Number.isFinite(Date.parse(row.signalAt)) &&
      /^\d{4}-\d{2}-\d{2}$/.test(row.fromDate) &&
      /^\d{4}-\d{2}-\d{2}$/.test(row.toDate) && row.toDate > row.fromDate &&
      ["nikkei", "topix"].includes(row.benchmark) &&
      ["daily_close", "intraday_0905"].includes(row.window) &&
      Number.isFinite(row.stockReturnPct) && Number.isFinite(row.marketReturnPct) &&
      Number.isFinite(row.excessReturnPoints) &&
      Math.abs(row.stockReturnPct - row.marketReturnPct - row.excessReturnPoints) < 1e-8;
    if (!valid || seen.has(key)) { rejected++; continue; }
    seen.add(key);
    if (row.aiPowerAtSignal < 40) {
      eligibleLow++;
      if (row.stockReturnPct >= thresholdPct && row.excessReturnPoints > 0) lowScoreRallies.push(row);
    }
    if (row.aiPowerAtSignal >= 90) {
      eligibleHigh++;
      if (row.stockReturnPct <= -thresholdPct && row.excessReturnPoints < 0) highScoreFalls.push(row);
    }
  }
  return { status: "observed" as const, eligibleLow, eligibleHigh, rejected,
    lowScoreRallies, highScoreFalls,
    lowScoreRallyRatePct: eligibleLow ? 100 * lowScoreRallies.length / eligibleLow : null,
    highScoreFallRatePct: eligibleHigh ? 100 * highScoreFalls.length / eligibleHigh : null,
    caveat: "Retrospective, non-causal, no trading recommendations. Stratify by matching benchmark, date and horizon." };
}
