import "server-only";
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
async function fetchCompletedDailyBars(code: string, allowTodayJst: string | null): Promise<LoadedStock> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_500);
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(code + ".T")}?range=6mo&interval=1d`;
    const response = await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: controller.signal,
    });
    if (!response.ok) return { code, candles: [], error: "株価取得に失敗（応答エラー）" };
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
    const canUseCompletedToday = allowTodayJst === cutoff;
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
        (canUseCompletedToday ? dateJst(time) > cutoff : dateJst(time) >= cutoff)) continue; // Today permitted only to the post-close authorized Cron caller.
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

export async function fetchCohort(codes: string[], options: { completedTodayJst?: string } = {}): Promise<LoadedStock[]> {
  if (codes.length < 1 || codes.length > 5 || new Set(codes).size !== codes.length ||
    codes.some(code => !/^[0-9A-Z]{4,5}$/.test(code))) throw new Error("RESEARCH_FETCH_LIMIT");
  const allowToday = options.completedTodayJst && /^\\d{4}-\\d{2}-\\d{2}$/.test(options.completedTodayJst)
    ? options.completedTodayJst : null;
  const results: LoadedStock[] = new Array(codes.length);
  let nextIndex = 0;
  // At most 3 simultaneous HTTP calls, at most 5 in total.
  const worker = async () => {
    while (nextIndex < codes.length) {
      const index = nextIndex++;
      results[index] = await fetchCompletedDailyBars(codes[index], allowToday);
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, codes.length) }, () => worker()));
  return results;
}

