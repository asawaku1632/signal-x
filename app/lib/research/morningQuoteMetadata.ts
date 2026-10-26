/**
 * Research-only metadata classifier for a 5-minute chart response.
 * No network, price persistence, DB access, notifications, or trading decisions.
 * Caller must not log raw payloads, OHLCV, symbols, tokens, or user information.
 */
export type QuoteMetadataReason =
  | "UPSTREAM_HTTP_ERROR" | "PROVIDER_CHART_ERROR" | "NO_RESULT"
  | "NO_TIMESTAMP_ARRAY" | "NO_QUOTE_ARRAY" | "MISSING_0900_BAR"
  | "MISSING_0905_BAR" | "BARS_PRESENT_NOT_PRICE_VALIDATED";

export type QuoteMetadata = {
  reason: QuoteMetadataReason;
  httpStatusClass: string;
  timestampCount: number | null;
  has0900: boolean | null;
  has0905: boolean | null;
};

const tokyoClock = (timestamp: number): {date: string; time: string} | null => {
  if (!Number.isFinite(timestamp)) return null;
  const d = new Date(timestamp * 1000);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(d);
  const get = (key: string) => parts.find(p => p.type === key)?.value ?? "";
  return {date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}`};
};

export function classifyFiveMinuteMetadata(
  payload: unknown, httpStatus: number, tradeDate: string,
): QuoteMetadata {
  const httpStatusClass = Number.isInteger(httpStatus) && httpStatus >= 100 && httpStatus <= 599
    ? `${Math.floor(httpStatus / 100)}xx` : "unknown";
  const base = {httpStatusClass, timestampCount: null, has0900: null, has0905: null};
  if (httpStatus < 200 || httpStatus >= 300)
    return {...base, reason: "UPSTREAM_HTTP_ERROR"};
  const chart = (payload as {chart?: unknown} | null)?.chart;
  if (!chart || typeof chart !== "object") return {...base, reason: "NO_RESULT"};
  const c = chart as {error?: unknown; result?: unknown};
  if (c.error) return {...base, reason: "PROVIDER_CHART_ERROR"};
  if (!Array.isArray(c.result) || !c.result[0] || typeof c.result[0] !== "object")
    return {...base, reason: "NO_RESULT"};
  const data = c.result[0] as {timestamp?: unknown; indicators?: {quote?: unknown}};
  if (!Array.isArray(data.timestamp)) return {...base, reason: "NO_TIMESTAMP_ARRAY"};
  if (!Array.isArray(data.indicators?.quote) || !data.indicators.quote[0])
    return {...base, reason: "NO_QUOTE_ARRAY"};
  const times = new Set(
    data.timestamp
      .filter((t: unknown): t is number => typeof t === "number")
      .map(tokyoClock)
      .filter((t): t is {date: string; time: string} => t !== null && t.date === tradeDate)
      .map(t => t.time),
  );
  const has0900 = times.has("09:00");
  const has0905 = times.has("09:05");
  return {
    httpStatusClass, timestampCount: data.timestamp.length, has0900, has0905,
    reason: !has0900 ? "MISSING_0900_BAR" : !has0905 ? "MISSING_0905_BAR" : "BARS_PRESENT_NOT_PRICE_VALIDATED",
  };
}
