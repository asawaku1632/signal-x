import {classifyFiveMinuteMetadata} from "./morningQuoteMetadata";

export type MorningQuoteSafeRecord = Readonly<{
  research_run_date: string;
  stage: "existing_response" | "upstream_failure" | "parser_failure";
  reason: string;
  http_status_class: string;
  timestamp_count: number | null;
  has_0900: boolean | null;
  has_0905: boolean | null;
  classifier_version: "metadata-v1";
}>;

/**
 * Pure, opt-in metadata extraction from a response already fetched elsewhere.
 * Does not fetch, persist, log, identify a ticker, or change a trade decision.
 * No call from the production runner until provider rights and isolation are approved.
 */
export function safeMorningQuoteRecord(
  payload: unknown, httpStatus: number, tradeDate: string,
): MorningQuoteSafeRecord | null {
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(tradeDate)) return null;
  try {
    const m = classifyFiveMinuteMetadata(payload, httpStatus, tradeDate);
    const count = m.timestampCount === null ? null
      : Number.isInteger(m.timestampCount) ? Math.min(75, Math.max(0, m.timestampCount)) : null;
    return Object.freeze({
      research_run_date: tradeDate,
      stage: httpStatus < 200 || httpStatus >= 300 ? "upstream_failure" : "existing_response",
      reason: m.reason,
      http_status_class: ["2xx","3xx","4xx","5xx"].includes(m.httpStatusClass)
        ? m.httpStatusClass : "unknown",
      timestamp_count: count,
      has_0900: m.has0900,
      has_0905: m.has0905,
      classifier_version: "metadata-v1",
    });
  } catch {
    return Object.freeze({
      research_run_date: tradeDate, stage: "parser_failure", reason: "CLASSIFIER_ERROR",
      http_status_class: "unknown", timestamp_count: null,
      has_0900: null, has_0905: null, classifier_version: "metadata-v1",
    });
  }
}
