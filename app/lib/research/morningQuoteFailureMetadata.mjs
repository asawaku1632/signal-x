// Offline research only. No network, database, or production runner imports.
const KNOWN = new Set(["UPSTREAM_HTTP_ERROR","UPSTREAM_TIMEOUT","JSON_PARSE_ERROR","UPSTREAM_FETCH_ERROR"]);
export function classifyMorningQuoteFailure(input) {
  const status = input && typeof input === "object" ? input.httpStatus : undefined;
  const error = input && typeof input === "object" ? input.error : undefined;
  const name = error instanceof Error ? error.name : "";
  const httpStatusClass = Number.isInteger(status) && status >= 100 && status <= 599
    ? String(Math.floor(status / 100))+"xx" : "unknown";
  let reason;
  if (Number.isInteger(status) && (status < 200 || status >= 300)) reason = "UPSTREAM_HTTP_ERROR";
  else if (name === "TimeoutError" || name === "AbortError") reason = "UPSTREAM_TIMEOUT";
  else if (error instanceof SyntaxError) reason = "JSON_PARSE_ERROR";
  else reason = "UPSTREAM_FETCH_ERROR";
  if (!KNOWN.has(reason)) throw Error("UNKNOWN_REASON");
  return Object.freeze({stage:"upstream_failure",reason,http_status_class:httpStatusClass,
    timestamp_count:null,has_0900:null,has_0905:null,classifier_version:"metadata-v1",
    price_validated:false});
}
