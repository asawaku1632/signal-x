/**
 * Offline validation of externally supplied J-Quants V2 adjusted daily bars.
 * This does not grant data licensing or certify corporate-action methodology.
 * Fail the entire batch on malformed or duplicate records; never silently
 * drop records and inflate forward outcome coverage.
 */
const validDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !Number.isNaN(Date.parse(v + "T00:00:00Z")) &&
  new Date(v + "T00:00:00Z").toISOString().slice(0, 10) === v;
const validCode = (v) => typeof v === "string" && /^\d{4,5}$/.test(v);
const positiveNumber = (v) => typeof v === "number" && Number.isFinite(v) && v > 0;

export function validateJQuantsDailyResearchBatch({ rows, sessions, expectedCodes }) {
  if (!Array.isArray(rows) || !Array.isArray(sessions) || !Array.isArray(expectedCodes)) {
    throw new TypeError("rows, sessions and expectedCodes must be arrays");
  }
  const issues = [];
  const codes = new Set(expectedCodes);
  if (!expectedCodes.length || codes.size !== expectedCodes.length ||
      expectedCodes.some((c) => !validCode(c))) issues.push("INVALID_EXPECTED_CODES");
  if (!sessions.length || sessions.some((d, i) => !validDate(d) ||
      (i > 0 && d <= sessions[i - 1]))) issues.push("INVALID_TRADING_CALENDAR");
  const sessionSet = new Set(sessions);
  const seen = new Set();
  for (const [index, row] of rows.entries()) {
    if (!row || !validCode(row.code) || !codes.has(row.code)) {
      issues.push(`INVALID_CODE_AT_${index}`); continue;
    }
    if (!validDate(row.date) || !sessionSet.has(row.date)) {
      issues.push(`INVALID_OR_OUT_OF_CALENDAR_DATE_AT_${index}`); continue;
    }
    const k = row.code + "|" + row.date;
    if (seen.has(k)) issues.push(`DUPLICATE_BAR_AT_${index}`);
    seen.add(k);
    if (!positiveNumber(row.close)) issues.push(`INVALID_ADJUSTED_CLOSE_AT_${index}`);
    if (row.priceField !== "AdjC" || row.provider !== "JQUANTS_V2") {
      issues.push(`INVALID_PRICE_PROVENANCE_AT_${index}`);
    }
    if (row.priceBasisVerified !== true || row.corporateActionUnresolved !== false) {
      issues.push(`UNVERIFIED_PRICE_BASIS_AT_${index}`);
    }
  }
  return { accepted: issues.length === 0, status: issues.length ? "REJECTED" : "ACCEPTED",
    issues, rowsChecked: rows.length, expectedCodeCount: codes.size, tradingSessionCount: sessions.length };
}
