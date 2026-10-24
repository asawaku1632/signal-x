/**
 * Read-only cohort statistics for the low-rating recovery study.
 * Callers must supply frozen historical observations; this module never fetches
 * prices or mutates decisions. Percent returns are relative to original signal.
 */
export type RecoveryObservation = {
  code: string;
  signalDate: string;
  status: "WATCH" | "AVOID" | "WAIT" | "CANDIDATE";
  returns: { 1: number | null; 3: number | null; 5: number | null; 10: number | null };
};
const HORIZONS = [1, 3, 5, 10] as const;
type Horizon = (typeof HORIZONS)[number];
const finite = (v: number | null): v is number => v !== null && Number.isFinite(v);
const mean = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const median = (a: number[]) => {
  if (!a.length) return null;
  const sorted = [...a].sort((x, y) => x - y);
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
};
export function summarizeRecoveryCohort(rows: RecoveryObservation[]) {
  const seen = new Set<string>();
  const unique = rows.filter(r => {
    const key = JSON.stringify([r.code, r.signalDate]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const paired = unique.filter(r => HORIZONS.every(d => finite(r.returns[d])));
  const horizon = HORIZONS.map(days => {
    const valid = unique.map(r => r.returns[days]).filter(finite);
    return {
      days, observed: valid.length, missing: unique.length - valid.length,
      meanPct: mean(valid), medianPct: median(valid),
      up: valid.filter(v => v > 0).length,
      plus3: valid.filter(v => v >= 3).length,
      minus3: valid.filter(v => v <= -3).length,
    };
  });
  const pairedHorizon = HORIZONS.map(days => ({
    days, observed: paired.length,
    meanPct: mean(paired.map(r => r.returns[days] as number)),
    medianPct: median(paired.map(r => r.returns[days] as number)),
  }));
  // Endpoint-only trajectories: not intraday or intra-period maximum drawdown.
  const recovered = paired.filter(r =>
    HORIZONS.slice(0, -1).some(d => (r.returns[d] as number) < 0) &&
    (r.returns[10] as number) > 0);
  const alwaysPositive = paired.filter(r =>
    HORIZONS.every(d => (r.returns[d] as number) > 0));
  const distinctDates = new Set(unique.map(r => r.signalDate)).size;
  const pairedDates = new Set(paired.map(r => r.signalDate)).size;
  return {
    total: unique.length, distinctDates, pairedCount: paired.length, pairedDates,
    horizon, pairedHorizon, recoveredCount: recovered.length,
    alwaysPositiveCount: alwaysPositive.length,
    // A single assessment date is not enough to establish a time-robust result.
    insufficientEvidence: pairedDates < 10,
    note: "Returns are frozen signal-price endpoint comparisons. Paired trajectories only include complete 1/3/5/10-day observations; endpoint minima are not maximum drawdown.",
  };
}
