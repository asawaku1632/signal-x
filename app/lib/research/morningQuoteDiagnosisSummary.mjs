/**
 * Pure, offline analysis of approved, already collected metadata.
 * Never fetches prices, writes to DB, or claims to diagnose unobserved failures.
 */
const REASONS = new Set([
  "UPSTREAM_HTTP_ERROR","UPSTREAM_TIMEOUT","UPSTREAM_FETCH_ERROR","JSON_PARSE_ERROR","CLASSIFIER_ERROR",
  "PROVIDER_CHART_ERROR","NO_RESULT","NO_TIMESTAMP_ARRAY","NO_QUOTE_ARRAY",
  "MISSING_0900_BAR","MISSING_0905_BAR","BARS_PRESENT_NOT_PRICE_VALIDATED"
]);
const VALID_STAGES = new Set(["existing_response","upstream_failure","parser_failure"]);
export function summarizeMorningQuoteDiagnostics(rows) {
  if (!Array.isArray(rows)) throw new TypeError("rows must be an array");
  const counts = Object.fromEntries([...REASONS].map(reason => [reason,0]));
  let accepted = 0, rejected = 0, timestampPresence = 0;
  for (const row of rows) {
    if (!row || typeof row !== "object" ||
      !REASONS.has(row.reason) || !VALID_STAGES.has(row.stage) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(row.research_run_date ?? "") ||
      row.classifier_version !== "metadata-v1") {
      rejected++; continue;
    }
    counts[row.reason]++; accepted++;
    if (row.reason === "BARS_PRESENT_NOT_PRICE_VALIDATED") timestampPresence++;
  }
  return Object.freeze({
    total: rows.length, accepted, rejected,
    counts: Object.freeze(counts),
    timestampsPresentNotPriceValidated: timestampPresence,
    priceValidityEstablished: false,
    rootCauseConfirmed: false,
  });
}
