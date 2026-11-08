import "server-only";
import {createHash} from "node:crypto";
import type { ShadowCandle } from "@/app/lib/research/shadowCandlestickNine";

// Yahoo lookups may be called ONLY after owner verification by the caller.
// Explicit buttons only, max five unique codes, max three simultaneous calls.
const MAX_HISTORY = 135;

export type LoadedStock = {
  code: string;
  candles: ShadowCandle[];
  error: string | null;
};

export function dateJst(seconds: number) {
  return new Date(seconds * 1000).toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}
function jstToday() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}
function positive(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

// Per-click, owner-only, bounded and explicitly selected codes.
// No periodic work, writing, caching, background collection or bulk universe access.
async function fetchCompletedDailyBars(code: string, host = "query1.finance.yahoo.com"): Promise<LoadedStock> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_500);
  try {
    const url = `https://${host}/v8/finance/chart/${encodeURIComponent(code + ".T")}?range=6mo&interval=1d`;
    const response = await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: controller.signal,
    });
    if (!response.ok) return { code, candles: [], error: `HTTP_${response.status}` };
    const value: unknown = await response.json();
    const chart = (value as {
      chart?: {
        error?: unknown;
        result?: Array<{
          timestamp?: unknown;
          indicators?: { quote?: Array<{
            open?: unknown; high?: unknown; low?: unknown; close?: unknown; volume?: unknown;
          }> };
        }>;
      };
    })?.chart;
    if (!chart || chart.error || !Array.isArray(chart.result)) throw new Error("invalid market data");
    const first = chart.result[0];
    const timeValues = first?.timestamp;
    const quote = first?.indicators?.quote?.[0];
    if (!Array.isArray(timeValues) || !quote ||
      !Array.isArray(quote.open) || !Array.isArray(quote.high) ||
      !Array.isArray(quote.low) || !Array.isArray(quote.close)) throw new Error("missing daily OHLC");

    const cutoff = jstToday();
    const candles: ShadowCandle[] = [];
    for (let i = 0; i < timeValues.length; i++) {
      const time = positive(timeValues[i]);
      const open = positive(quote.open[i]);
      const high = positive(quote.high[i]);
      const low = positive(quote.low[i]);
      const close = positive(quote.close[i]);
      if (!time || !open || !high || !low || !close ||
        high < Math.max(open, low, close) ||
        low > Math.min(open, high, close) ||
        dateJst(time) >= cutoff) continue; // Excludes incomplete/current-day OHLC.
      if (candles.length && time <= candles[candles.length - 1].time) continue;
      candles.push({
        time, open, high, low, close,
        volume: Array.isArray(quote.volume) ? positive(quote.volume[i]) ?? undefined : undefined,
      });
    }
    if (candles.length < 20) return { code, candles: [], error: "確定済み日足が20本未満" };
    return { code, candles: candles.slice(-MAX_HISTORY), error: null };
  } catch (error) {
    console.warn("shadow batch daily-data fetch failed", code, error instanceof Error ? error.message : "unknown");
    return { code, candles: [], error: "参考日足が取得できませんでした" };
  } finally {
    clearTimeout(timer);
  }
}

// Defensive maximum on the server, regardless of the form's input checks.
async function fetchBoundedCohort(codes: string[], maximum: number): Promise<LoadedStock[]> {
  if (!Array.isArray(codes) || codes.length < 1 || codes.length > maximum
    || new Set(codes).size !== codes.length
    || codes.some(code => typeof code !== "string" || !/^[0-9]{4}$/.test(code))) {
    throw new Error("invalid explicitly selected research cohort");
  }
  const results: LoadedStock[] = new Array(codes.length);
  let nextIndex = 0;
  // At most 3 simultaneous HTTP calls, at most 5 in total.
  const worker = async () => {
    while (nextIndex < codes.length) {
      const index = nextIndex++;
      results[index] = await fetchCompletedDailyBars(codes[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, codes.length) }, () => worker()));
  return results;
}

// Existing five-stock research pages retain their original cap.
export async function fetchCohort(codes: string[]): Promise<LoadedStock[]> {
  return fetchBoundedCohort(codes, 5);
}

// Separate owner-triggered extended replay, max 15 codes / 3 upstream calls in
// parallel. Never invoke from an automatic job or public endpoint.
export async function fetchNecklineExtendedCohort(codes: string[]): Promise<LoadedStock[]> {
  return fetchBoundedCohort(codes, 15);
}


/**
 * Owner-only or authenticated research-cron only. A transient Yahoo error is
 * retried once on the alternative Yahoo chart host. This NEVER fabricates OHLC,
 * silently drops a requested code, or recovers an older forward candidate.
 * Maximum 15 selected codes, 3 concurrent workers, 2 requests per code.
 */
export type NecklineStableStock = LoadedStock & {
  attempts: number;
  source: string;
  barsSha256: string | null;
  latestDate: string | null;
};
export async function fetchNecklineStableCohort(codes: string[]): Promise<NecklineStableStock[]> {
  if (!Array.isArray(codes) || codes.length < 1 || codes.length > 15
    || new Set(codes).size !== codes.length
    || codes.some(code => !/^[0-9]{4}$/.test(code))) {
    throw new Error("INVALID_NECKLINE_COHORT");
  }
  const results: NecklineStableStock[] = new Array(codes.length);
  let current = 0;
  const worker = async () => {
    while (current < codes.length) {
      const index = current++;
      const code = codes[index];
      let last: LoadedStock = {code,candles:[],error:"データ未取得"};
      let attempts = 0, source = "YAHOO_QUERY1_1D";
      for (const [i,host] of ["query1.finance.yahoo.com","query2.finance.yahoo.com"].entries()) {
        // A 404/400 is usually a missing listing/code; do not retry it.
        if (i > 0 && /^(HTTP_400|HTTP_404)$/.test(last.error ?? "")) break;
        attempts++;
        source = host.startsWith("query1") ? "YAHOO_QUERY1_1D" : "YAHOO_QUERY2_1D";
        last = await fetchCompletedDailyBars(code,host);
        if (!last.error && last.candles.length >= 25) break;
      }
      const candles = last.error ? [] : last.candles;
      results[index] = {
        code, candles, error:last.error ?? (candles.length < 25 ? "日足25本未満" : null),
        attempts, source,
        barsSha256: candles.length >= 25
          ? createHash("sha256").update(JSON.stringify(candles)).digest("hex") : null,
        latestDate: candles.length ? dateJst(candles[candles.length - 1].time) : null,
      };
    }
  };
  await Promise.all(Array.from({length:Math.min(3,codes.length)},worker));
  return results;
}
