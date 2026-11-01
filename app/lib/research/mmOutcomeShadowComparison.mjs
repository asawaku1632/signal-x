import { alignVerifiedSessionHorizons } from "./verifiedSessionHorizons.mjs";

/**
 * Read-only comparison: never updates persisted outcomes.
 * Missing TOPIX does not invalidate stock-only comparison; both results are
 * reported independently. Calendar provenance must be verified upstream.
 */
export function compareMmOutcomeShadow({
  observations, exchangeSessions, calendarVerified, calendarComplete,
  stockClosesByCode, indexCloses, asOfDate,
} = {}) {
  if (!calendarVerified || !calendarComplete) {
    return { status: "BLOCKED", reason: "UNVERIFIED_EXCHANGE_CALENDAR", rows: [] };
  }
  if (!Array.isArray(observations) || !(stockClosesByCode instanceof Map)) {
    return { status: "BLOCKED", reason: "INVALID_INPUT", rows: [] };
  }
  const rows = observations.map((observation) => {
    const { code, tradeDate, storedResult1d, storedResult3d, storedResult5d } = observation;
    const result = alignVerifiedSessionHorizons({
      signalDate: tradeDate, asOfDate, exchangeSessions,
      calendarVerified, calendarComplete,
      stockCloses: stockClosesByCode.get(code), indexCloses,
    });
    const horizons = {};
    for (const h of [1, 3, 5]) {
      const saved = { 1: storedResult1d, 3: storedResult3d, 5: storedResult5d }[h];
      const candidate = result.horizons[h];
      horizons[h] = {
        sessionDate: candidate?.date ?? null,
        status: candidate?.status ?? result.status,
        storedReturn: typeof saved === "number" && Number.isFinite(saved) ? saved : null,
        shadowReturn: candidate?.status === "READY" ? candidate.stockReturn : null,
        delta: candidate?.status === "READY" && typeof saved === "number" && Number.isFinite(saved)
          ? candidate.stockReturn - saved : null,
        benchmarkReturn: candidate?.status === "READY" ? candidate.benchmarkReturn : null,
        excessReturn: candidate?.status === "READY" ? candidate.excessReturn : null,
      };
    }
    return { code, tradeDate, horizons };
  });
  return { status: "RESEARCH_ONLY", rows };
}
