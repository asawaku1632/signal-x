// Research-only filter. Never modifies stored outcomes or production scoring.
// Fail closed: unverified records are excluded from performance comparisons.
export function assessDailyResultQuality(row, options = {}) {
  const reasons = [];
  const date = String(row?.date ?? "");
  const entry = row?.price == null ? NaN : Number(row.price);
  const next = row?.next_price == null ? NaN : Number(row.next_price);
  const change = row?.change_percent == null ? NaN : Number(row.change_percent);
  const score = row?.score == null ? NaN : Number(row.score);
  const result = row?.result;
  const excludedDates = new Set(options.excludedDates ?? ["2026-09-21"]);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) reasons.push("invalid_date");
  if (excludedDates.has(date)) reasons.push("quarantined_date");
  if (!Number.isFinite(score) || score < 0 || score > 100) reasons.push("invalid_score");
  if (!Number.isFinite(entry) || entry <= 0 || !Number.isFinite(next) || next <= 0) reasons.push("invalid_price");
  if (!Number.isFinite(change)) reasons.push("missing_change");
  if (!["WIN", "LOSE", "HOLD"].includes(result)) reasons.push("unjudged");
  if (Number.isFinite(entry) && entry > 0 && Number.isFinite(next) && next > 0 && Number.isFinite(change)) {
    const expected = Math.round(((next - entry) / entry) * 10000) / 100;
    if (Math.abs(expected - change) > 0.011) reasons.push("price_change_mismatch");
    const expectedResult = expected >= 2 ? "WIN" : expected <= -2 ? "LOSE" : "HOLD";
    if (result !== expectedResult) reasons.push("result_mismatch");
  }
  // Provenance is mandatory for any record used to claim validated accuracy.
  if (options.requireProvenance !== false && row?.provenance_verified !== true) reasons.push("unverified_provenance");
  return { eligible: reasons.length === 0, reasons };
}
