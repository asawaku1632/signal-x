import { createCandleDataset, type DatasetRequirement } from "./datasets.ts";
import type { CandleDataset, TechnicalCandle } from "./types.ts";
import { allSettledWithConcurrency } from "../learning/promisePool.ts";

export const DAILY_DATASET_DEFAULT_CONCURRENCY = 4;
export const DAILY_DATASET_MAX_CONCURRENCY = 5;

export const DAILY_DATA_PROFILES = {
  SHORT_90: {
    range: "6mo",
    interval: "1d",
    sliceLimit: 90,
    ttlMs: 6 * 60 * 60 * 1_000,
    revalidateSeconds: 6 * 60 * 60,
  },
  LONG_300: {
    range: "2y",
    interval: "1d",
    sliceLimit: 300,
    ttlMs: 24 * 60 * 60 * 1_000,
    revalidateSeconds: 24 * 60 * 60,
  },
} as const;

export type DailyDataProfile = keyof typeof DAILY_DATA_PROFILES;
type FetchLike = typeof fetch;
type CacheEntry = { expiresAt: number; value: Promise<CandleDataset> };

export type DailyDataFetchFailureKind = "HTTP_429" | "HTTP_FAILURE" | "TIMEOUT" | "MALFORMED_JSON";

export class DailyDataFetchError extends Error {
  readonly kind: DailyDataFetchFailureKind;
  constructor(kind: DailyDataFetchFailureKind) {
    super(`DAILY_DATA_${kind}`);
    this.name = "DailyDataFetchError";
    this.kind = kind;
  }
}

const dailyDatasetCache = new Map<string, CacheEntry>();
let dailyDatasetCacheHits = 0;
let dailyDatasetExternalFetches = 0;

function normalizeYahooCandles(result: Record<string, unknown>): TechnicalCandle[] {
  const timestamps = Array.isArray(result.timestamp) ? result.timestamp : [];
  const indicators = result.indicators as { quote?: Array<Record<string, unknown[]>> } | undefined;
  const quote = indicators?.quote?.[0];
  if (!quote) return [];
  return timestamps.flatMap((rawTime, index) => {
    const values = {
      time: Number(rawTime),
      open: Number(quote.open?.[index]),
      high: Number(quote.high?.[index]),
      low: Number(quote.low?.[index]),
      close: Number(quote.close?.[index]),
      volume: Number(quote.volume?.[index] ?? 0),
    };
    return Object.values(values).every(Number.isFinite) ? [values] : [];
  });
}

export function clearDailyDatasetCache() {
  dailyDatasetCache.clear();
  dailyDatasetCacheHits = 0;
  dailyDatasetExternalFetches = 0;
}

export function getDailyDatasetCacheStats() {
  return { cacheHits: dailyDatasetCacheHits, externalFetches: dailyDatasetExternalFetches };
}

export async function fetchDailyCandleDataset(
  code: string,
  profile: DailyDataProfile,
  requirement: DatasetRequirement,
  options: {
    fetcher?: FetchLike;
    timeoutMs?: number;
    nowMs?: number;
    bypassMemoryCache?: boolean;
  } = {},
) {
  const normalizedCode = String(code).replace(/\.T$/i, "");
  if (!/^\d{4}$/.test(normalizedCode)) {
    throw new Error(`invalid Japan stock code: ${code}`);
  }
  const config = DAILY_DATA_PROFILES[profile];
  const nowMs = options.nowMs ?? Date.now();
  const cacheKey = `${normalizedCode}:${profile}:${requirement.minimumCandles}:${requirement.recommendedCandles ?? ""}`;
  const cached = dailyDatasetCache.get(cacheKey);
  if (!options.bypassMemoryCache && cached && cached.expiresAt > nowMs) {
    dailyDatasetCacheHits += 1;
    return cached.value;
  }
  dailyDatasetExternalFetches += 1;

  const request = (async () => {
    let response: Response;
    try {
      response = await (options.fetcher ?? fetch)(
        `https://query1.finance.yahoo.com/v8/finance/chart/${normalizedCode}.T?range=${config.range}&interval=${config.interval}`,
        {
          headers: { "User-Agent": "Mozilla/5.0" },
          signal: AbortSignal.timeout(options.timeoutMs ?? 8_000),
          next: { revalidate: config.revalidateSeconds },
        },
      );
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      throw new DailyDataFetchError(name === "AbortError" || name === "TimeoutError" ? "TIMEOUT" : "HTTP_FAILURE");
    }
    if (!response.ok) throw new DailyDataFetchError(response.status === 429 ? "HTTP_429" : "HTTP_FAILURE");
    let json: any;
    try {
      json = await response.json();
    } catch {
      throw new DailyDataFetchError("MALFORMED_JSON");
    }
    const result = json?.chart?.result?.[0] as Record<string, unknown> | undefined;
    const candles = result ? normalizeYahooCandles(result).slice(-config.sliceLimit) : [];
    return createCandleDataset({
      timeframe: "1D",
      source: "YAHOO_CHART",
      range: config.range,
      interval: config.interval,
      candles,
      requirement,
      nowMs,
    }) as CandleDataset & { timeframe: "1D" };
  })();

  if (!options.bypassMemoryCache) {
    dailyDatasetCache.set(cacheKey, { expiresAt: nowMs + config.ttlMs, value: request });
    request.catch(() => dailyDatasetCache.delete(cacheKey));
  }
  return request;
}

export async function fetchDailyCandleDatasets(
  codes: readonly string[],
  profile: DailyDataProfile,
  requirement: DatasetRequirement,
  options: {
    concurrency?: number;
    fetcher?: FetchLike;
    timeoutMs?: number;
    nowMs?: number;
  } = {},
) {
  const uniqueCodes = Array.from(new Set(codes.map((code) => String(code))));
  const concurrency = Math.min(
    DAILY_DATASET_MAX_CONCURRENCY,
    Math.max(1, Math.floor(options.concurrency ?? DAILY_DATASET_DEFAULT_CONCURRENCY)),
  );
  const settled = await allSettledWithConcurrency(
    uniqueCodes,
    concurrency,
    async (code) => ({
      code,
      dataset: await fetchDailyCandleDataset(code, profile, requirement, options),
    }),
  );
  return { concurrency, requested: codes.length, unique: uniqueCodes.length, settled };
}
