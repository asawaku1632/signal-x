/**
 * Pure research-only horizon alignment. Never infers sessions from saved
 * stock rows or market_learning_logs. The caller must supply an independently
 * verified, complete exchange calendar and provenance.
 */
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (value) => typeof value === "string" &&
  datePattern.test(value) && !Number.isNaN(Date.parse(value + "T00:00:00Z")) &&
  new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value;
const positive = (value) => typeof value === "number" && Number.isFinite(value) && value > 0;

export function alignVerifiedSessionHorizons({
  signalDate, asOfDate, exchangeSessions, calendarVerified = false,
  calendarComplete = false, stockCloses, indexCloses, horizons = [1, 3, 5],
} = {}) {
  const blocked = (reason) => ({ status: "BLOCKED", reason, horizons: {} });
  if (!calendarVerified || !calendarComplete) return blocked("UNVERIFIED_EXCHANGE_CALENDAR");
  if (!validDate(signalDate) || !validDate(asOfDate) || signalDate >= asOfDate)
    return blocked("INVALID_AS_OF");
  if (!Array.isArray(exchangeSessions) || !exchangeSessions.length ||
      exchangeSessions.some((d) => !validDate(d)) ||
      exchangeSessions.some((d, i) => i > 0 && d <= exchangeSessions[i - 1]))
    return blocked("INVALID_SESSION_SEQUENCE");
  const pos = exchangeSessions.indexOf(signalDate);
  if (pos < 0) return blocked("SIGNAL_NOT_IN_VERIFIED_SESSIONS");
  if (!Array.isArray(horizons) || !horizons.length ||
      horizons.some((h) => !Number.isInteger(h) || h <= 0))
    return blocked("INVALID_HORIZONS");
  const stock = stockCloses instanceof Map ? stockCloses : new Map();
  const index = indexCloses instanceof Map ? indexCloses : new Map();
  const baseStock = stock.get(signalDate);
  const baseIndex = index.get(signalDate);
  if (!positive(baseStock) || !positive(baseIndex)) return blocked("MISSING_BASE_CLOSE");
  const result = {};
  for (const h of horizons) {
    const date = exchangeSessions[pos + h];
    if (!date || date >= asOfDate) {
      result[h] = { status: "PENDING", date: date ?? null };
      continue;
    }
    const futureStock = stock.get(date);
    const futureIndex = index.get(date);
    if (!positive(futureStock) || !positive(futureIndex)) {
      result[h] = { status: "MISSING_CLOSE", date };
      continue;
    }
    const stockReturn = (futureStock / baseStock - 1) * 100;
    const benchmarkReturn = (futureIndex / baseIndex - 1) * 100;
    result[h] = {
      status: "READY", date, stockReturn, benchmarkReturn,
      excessReturn: stockReturn - benchmarkReturn,
    };
  }
  return { status: "RESEARCH_ONLY", reason: null, horizons: result };
}
