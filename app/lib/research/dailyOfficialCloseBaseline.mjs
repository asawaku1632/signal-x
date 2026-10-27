import { evaluateDailyForward, FORWARD_HORIZONS } from "./dailyForwardEvaluation.mjs";

/**
 * Offline verified close-to-close research baseline.
 * Price rows are independently supplied from a licensed daily provider.
 * No API, DB, or trading calendar is inferred or accessed here.
 */
export function evaluateOfficialCloseBaseline({
  signals, dailyCloses, verifiedSessions, horizons = FORWARD_HORIZONS,
}) {
  if (!Array.isArray(signals) || !Array.isArray(dailyCloses) || !Array.isArray(verifiedSessions)) {
    throw new TypeError("signals, dailyCloses and verifiedSessions must be arrays");
  }
  const closeByKey = new Map();
  const duplicates = new Set();
  for (const c of dailyCloses) {
    if (!c || typeof c.code !== "string" || typeof c.date !== "string") continue;
    const k = c.code + "|" + c.date;
    if (closeByKey.has(k)) duplicates.add(k);
    else closeByKey.set(k, c);
  }
  const predictions = signals.map((s) => {
    const k = s.code + "|" + s.date;
    const base = closeByKey.get(k);
    const baseVerified = Boolean(base && !duplicates.has(k) &&
      base.priceBasisVerified === true && base.corporateActionUnresolved === false &&
      typeof base.close === "number" && Number.isFinite(base.close) && base.close > 0);
    return {
      id: s.id, code: s.code, date: s.date, score: s.score ?? null,
      referencePrice: baseVerified ? base.close : NaN,
      priceBasisVerified: baseVerified,
    };
  });
  const outcome = evaluateDailyForward({
    predictions, closes: dailyCloses, sessions: verifiedSessions, horizons,
  });
  return {
    version: 1,
    mode: "OFFLINE_OFFICIAL_CLOSE_BASELINE",
    basis: "VERIFIED_CLOSE_TO_FUTURE_CLOSE",
    ...outcome,
    warning: "Close-to-close outcome is post-hoc, not a tradable signal return or proof of original Yahoo scan price accuracy. Source licensing and corporate-action comparability require external verification.",
  };
}
