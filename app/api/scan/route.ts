import { NextResponse } from "next/server";
import {
  clampLimit,
  getFallbackTotalStockList,
  runScan,
} from "@/app/lib/learning/scanEngine";
import {
  buildScanErrorPayload,
  buildScanResponsePayload,
} from "@/app/lib/learning/notificationEngine";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const DEBUG_VERSION = "AI_POWER_V20_FINAL_ROUTE_REFACTOR_0706";
const AI_POWER_VERSION = "V20.0";

const CACHE_TIME = 60 * 1000;

type MarketFilter = "market-hot" | "market-watch" | null;

type CacheData = {
  timestamp: number;
  limit: number;
  stocks: any[];
  marketPattern?: string;
  totalStockList?: number;
};

let cacheData: CacheData | null = null;
let runningScanPromise: Promise<CacheData> | null = null;

function clampTop(value: number | null) {
  if (value === null || !Number.isFinite(value) || value < 1) {
    return null;
  }

  // 通常のScanは最大100件まで返し、スマホ表示を軽く保つ
  return Math.min(Math.floor(value), 100);
}

function parseMarketFilter(value: string | null): MarketFilter {
  if (value === "market-hot" || value === "market-watch") {
    return value;
  }

  return null;
}

function toFiniteNumber(value: unknown, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

/**
 * AI POWERが同点でも、HomeとScanで順位が変わらないように
 * 共通の並び順をAPI側で確定する。
 */
function sortStocksForRanking(stocks: any[]) {
  return [...stocks].sort((a, b) => {
    const scoreDiff =
      toFiniteNumber(b?.score ?? b?.aiPower) -
      toFiniteNumber(a?.score ?? a?.aiPower);

    if (scoreDiff !== 0) return scoreDiff;

    const changeDiff =
      toFiniteNumber(b?.changePercent) -
      toFiniteNumber(a?.changePercent);

    if (changeDiff !== 0) return changeDiff;

    const volumeDiff =
      toFiniteNumber(b?.volumeRatio) -
      toFiniteNumber(a?.volumeRatio);

    if (volumeDiff !== 0) return volumeDiff;

    return String(a?.code ?? "").localeCompare(String(b?.code ?? ""), "ja", {
      numeric: true,
    });
  });
}

/**
 * Today Marketから遷移した場合だけ、全スキャン結果から先に抽出する。
 * 通常のScanは上位100件のままなので、通信量と表示速度を維持できる。
 */
function filterStocks(stocks: any[], filter: MarketFilter) {
  if (filter === "market-hot") {
    return stocks.filter(
      (stock) => toFiniteNumber(stock?.score ?? stock?.aiPower) >= 75
    );
  }

  if (filter === "market-watch") {
    return stocks.filter((stock) => {
      const score = toFiniteNumber(stock?.score ?? stock?.aiPower);
      return score >= 65 && score < 75;
    });
  }

  return stocks;
}

function selectStocks(
  stocks: any[],
  top: number | null,
  filter: MarketFilter
) {
  const filteredStocks = filterStocks(stocks, filter);
  return top ? filteredStocks.slice(0, top) : filteredStocks;
}

async function getFreshScanData(limit: number): Promise<CacheData> {
  if (runningScanPromise) {
    return runningScanPromise;
  }

  runningScanPromise = (async () => {
    const scanResult = await runScan(limit);
    const sortedStocks = sortStocksForRanking(scanResult.stocks);

    const freshCache: CacheData = {
      timestamp: Date.now(),
      limit,
      stocks: sortedStocks,
      marketPattern: scanResult.marketPattern,
      totalStockList: scanResult.totalStockList,
    };

    cacheData = freshCache;
    return freshCache;
  })();

  try {
    return await runningScanPromise;
  } finally {
    runningScanPromise = null;
  }
}

export async function GET(req: Request) {
  const startedAt = Date.now();
  const now = Date.now();

  try {
    const { searchParams } = new URL(req.url);
    const limit = clampLimit(Number(searchParams.get("limit") || 200));
    const top = clampTop(
      searchParams.has("top") ? Number(searchParams.get("top")) : null
    );
    const filter = parseMarketFilter(searchParams.get("filter"));

    if (
      cacheData &&
      cacheData.limit === limit &&
      now - cacheData.timestamp < CACHE_TIME
    ) {
      const responseStocks = selectStocks(cacheData.stocks, top, filter);

      return NextResponse.json(
        buildScanResponsePayload({
          debugVersion: DEBUG_VERSION,
          aiPowerVersion: AI_POWER_VERSION,
          cached: true,
          limit: top ?? responseStocks.length,
          totalStockList:
            cacheData.totalStockList ?? getFallbackTotalStockList(),
          stocks: responseStocks,
          summaryStocks: cacheData.stocks,
          marketPattern: cacheData.marketPattern,
          cacheAge: Math.floor((now - cacheData.timestamp) / 1000),
        })
      );
    }

    const freshData = await getFreshScanData(limit);
    const responseStocks = selectStocks(freshData.stocks, top, filter);

    return NextResponse.json(
      buildScanResponsePayload({
        debugVersion: DEBUG_VERSION,
        aiPowerVersion: AI_POWER_VERSION,
        cached: false,
        limit: top ?? responseStocks.length,
        totalStockList:
          freshData.totalStockList ?? getFallbackTotalStockList(),
        stocks: responseStocks,
        summaryStocks: freshData.stocks,
        marketPattern: freshData.marketPattern,
        scanMs: Date.now() - startedAt,
      })
    );
  } catch (error) {
    if (cacheData) {
      const { searchParams } = new URL(req.url);
      const top = clampTop(
        searchParams.has("top") ? Number(searchParams.get("top")) : null
      );
      const filter = parseMarketFilter(searchParams.get("filter"));
      const responseStocks = selectStocks(cacheData.stocks, top, filter);

      return NextResponse.json(
        buildScanResponsePayload({
          debugVersion: DEBUG_VERSION,
          aiPowerVersion: AI_POWER_VERSION,
          cached: true,
          fallback: true,
          limit: top ?? responseStocks.length,
          totalStockList:
            cacheData.totalStockList ?? getFallbackTotalStockList(),
          stocks: responseStocks,
          summaryStocks: cacheData.stocks,
          marketPattern: cacheData.marketPattern,
          error: String(error),
        })
      );
    }

    return NextResponse.json(buildScanErrorPayload(DEBUG_VERSION, error), {
      status: 500,
    });
  }
}