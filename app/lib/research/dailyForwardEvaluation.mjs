/**
 * Research-only forward return evaluator. Pure and offline: no API/DB calls.
 * Sessions are explicit and must represent the verified trading calendar.
 * Prices must be on a comparable corporate-action basis, validated upstream.
 */
export const FORWARD_HORIZONS = Object.freeze([5, 10, 20]);

const validDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !Number.isNaN(Date.parse(v + "T00:00:00Z")) &&
  new Date(v + "T00:00:00Z").toISOString().slice(0, 10) === v;
const positive = (v) => typeof v === "number" && Number.isFinite(v) && v > 0;
const key = (code, date) => code + "|" + date;

/**
 * predictions: [{id,code,date,score,referencePrice,priceBasisVerified}]
 * closes: [{code,date,close,priceBasisVerified,corporateActionUnresolved}]
 * sessions: ISO trade dates in ascending order, verified externally.
 * Do not assume the J-Quants feed is licensed merely because data is supplied.
 */
export function evaluateDailyForward({ predictions, closes, sessions, horizons = FORWARD_HORIZONS }) {
  if (!Array.isArray(predictions) || !Array.isArray(closes) || !Array.isArray(sessions)) {
    throw new TypeError("predictions, closes and sessions must be arrays");
  }
  if (!sessions.every(validDate) || sessions.some((d, i) => i > 0 && d <= sessions[i - 1])) {
    throw new Error("sessions must be unique ascending valid ISO trading dates");
  }
  if (!Array.isArray(horizons) || !horizons.length ||
    horizons.some((h) => !Number.isSafeInteger(h) || h <= 0) ||
    new Set(horizons).size !== horizons.length) throw new Error("invalid horizons");

  const positions = new Map(sessions.map((d, i) => [d, i]));
  const closeMap = new Map();
  const duplicateCloseKeys = new Set();
  for (const row of closes) {
    if (!row || !validDate(row.date) || typeof row.code !== "string") continue;
    const k = key(row.code, row.date);
    if (closeMap.has(k)) duplicateCloseKeys.add(k);
    else closeMap.set(k, row);
  }
  const seenIds = new Set();
  const rows = [];
  for (const p of predictions) {
    if (!p || typeof p.id !== "string" || !p.id.trim() || seenIds.has(p.id)) {
      throw new Error("prediction ids must be unique nonempty strings");
    }
    seenIds.add(p.id);
    for (const horizon of horizons) {
      let status = "VERIFIED";
      let futureDate = null;
      let futureClose = null;
      let returnPct = null;
      const index = positions.get(p.date);
      if (typeof p.code !== "string" || !p.code.trim() || !validDate(p.date) ||
          !positive(p.referencePrice) || !positions.has(p.date)) status = "INVALID_PREDICTION";
      else if (p.priceBasisVerified !== true) status = "PRICE_BASIS_UNVERIFIED";
      else if (index + horizon >= sessions.length) status = "NOT_MATURED";
      else {
        futureDate = sessions[index + horizon];
        const k = key(p.code, futureDate);
        const price = closeMap.get(k);
        if (duplicateCloseKeys.has(k)) status = "DUPLICATE_FUTURE_PRICE";
        else if (!price || !positive(price.close)) status = "MISSING_FUTURE_PRICE";
        else if (price.corporateActionUnresolved === true || price.priceBasisVerified !== true) {
          status = "PRICE_BASIS_UNVERIFIED";
        } else {
          futureClose = price.close;
          returnPct = Math.round(((futureClose / p.referencePrice) - 1) * 10000) / 100;
        }
      }
      rows.push({ predictionId: p.id, code: p.code, date: p.date, score: p.score ?? null,
        horizon, futureDate, futureClose, returnPct, status });
    }
  }
  return { rows, summary: horizons.map((horizon) => {
    const subset = rows.filter((r) => r.horizon === horizon);
    const verified = subset.filter((r) => r.status === "VERIFIED");
    const counts = {};
    for (const row of subset) counts[row.status] = (counts[row.status] ?? 0) + 1;
    return { horizon, total: subset.length, verified: verified.length,
      positive: verified.filter((r) => r.returnPct > 0).length,
      negative: verified.filter((r) => r.returnPct < 0).length,
      flat: verified.filter((r) => r.returnPct === 0).length,
      positiveRate: verified.length ? verified.filter((r) => r.returnPct > 0).length / verified.length : null,
      statuses: counts };
  }) };
}
