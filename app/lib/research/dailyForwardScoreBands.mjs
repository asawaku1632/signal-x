/**
 * Pure offline analysis of verified forward outcomes by AI score band.
 * Never treat missing/unverified outcomes as losses or successes.
 * Rates are descriptive only; no claim of predictive edge or trade profit.
 */
export const DEFAULT_SCORE_BANDS = Object.freeze([
  { label: "0-19", min: 0, max: 19 },
  { label: "20-39", min: 20, max: 39 },
  { label: "40-54", min: 40, max: 54 },
  { label: "55-64", min: 55, max: 64 },
  { label: "65-79", min: 65, max: 79 },
  { label: "80-100", min: 80, max: 100 },
]);
export function summarizeVerifiedForwardByScoreBand(rows, { bands = DEFAULT_SCORE_BANDS, minSample = 20 } = {}) {
  if (!Array.isArray(rows)) throw new TypeError("rows must be an array");
  if (!Number.isSafeInteger(minSample) || minSample < 1) throw new Error("minSample must be positive integer");
  const horizons = [...new Set(rows.map((r) => r.horizon))].filter((h) => Number.isSafeInteger(h) && h > 0).sort((a,b)=>a-b);
  return horizons.flatMap((horizon) => bands.map((band) => {
    const candidates = rows.filter((r) => r.horizon === horizon &&
      typeof r.score === "number" && Number.isFinite(r.score) &&
      r.score >= band.min && r.score <= band.max);
    const verified = candidates.filter((r) => r.status === "VERIFIED" &&
      typeof r.returnPct === "number" && Number.isFinite(r.returnPct));
    const positive = verified.filter((r) => r.returnPct > 0).length;
    const negative = verified.filter((r) => r.returnPct < 0).length;
    const flat = verified.length - positive - negative;
    const n = verified.length;
    return {
      horizon, band: band.label, total: candidates.length, verified: n,
      excluded: candidates.length - n, positive, negative, flat,
      positiveRate: n >= minSample ? positive / n : null,
      averageReturnPct: n >= minSample ? Math.round(verified.reduce((a,r)=>a+r.returnPct,0)/n*100)/100 : null,
      status: n >= minSample ? "DESCRIPTIVE_ONLY" : "INSUFFICIENT_SAMPLE",
    };
  }));
}
