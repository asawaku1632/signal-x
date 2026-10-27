/** Research-only parser for an untrusted, unofficial Yahoo chart response.
 * No network calls, persistence, scoring, alerts or production wiring.
 * Never infer an observation timestamp from the request or capture clock.
 */
import { validateMarketIndexSnapshot, type MarketIndexObservation, type MarketIndexRejected } from "./marketIndexShadowContract";

export function parseNikkeiChartSnapshot(input: {
  payload: unknown;
  capturedAt: string;
  maxAgeMinutes?: number;
}): MarketIndexObservation | MarketIndexRejected {
  const reject = (reason: string): MarketIndexRejected =>
    ({ index: "nikkei", status: "invalid", reason });
  try {
    const root = input.payload as {
      chart?: { result?: Array<{
        meta?: { symbol?: unknown };
        timestamp?: unknown;
        indicators?: { quote?: Array<{ close?: unknown }> };
      }> };
    };
    const result = root?.chart?.result;
    if (!Array.isArray(result) || result.length !== 1) return reject("Exactly one chart result required");
    const record = result[0];
    if (record?.meta?.symbol !== "^N225") return reject("Unexpected index symbol");
    const timestamps = record.timestamp;
    const closes = record.indicators?.quote?.[0]?.close;
    if (!Array.isArray(timestamps) || !Array.isArray(closes) ||
        timestamps.length === 0 || timestamps.length !== closes.length)
      return reject("Missing or misaligned chart bars");
    // Reject incomplete latest bars instead of silently backfilling an older close.
    const last = timestamps.length - 1;
    const seconds = timestamps[last];
    if (typeof seconds !== "number" || !Number.isSafeInteger(seconds) || seconds <= 0)
      return reject("Invalid provider timestamp");
    return validateMarketIndexSnapshot({
      index: "nikkei",
      value: closes[last],
      observedAt: new Date(seconds * 1000).toISOString(),
      source: "yahoo-unofficial-chart:^N225:1m",
      capturedAt: input.capturedAt,
      maxAgeMinutes: input.maxAgeMinutes ?? 20,
    });
  } catch {
    return reject("Malformed provider response");
  }
}
