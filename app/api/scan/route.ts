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

  return Math.min(Math.floor(value), 100);
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

function selectStocks(stocks: any[], top: number | null) {
  return top ? stocks.slice(0, top) : stocks;
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
    const top = clampTop(Number(searchParams.get("top")));

    if (
      cacheData &&
      cacheData.limit === limit &&
      now - cacheData.timestamp < CACHE_TIME
    ) {
      const responseStocks = selectStocks(cacheData.stocks, top);

      return NextResponse.json(
        buildScanResponsePayload({
          debugVersion: DEBUG_VERSION,
          aiPowerVersion: AI_POWER_VERSION,
          cached: true,
          limit: top ?? limit,
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
    const responseStocks = selectStocks(freshData.stocks, top);

    return NextResponse.json(
      buildScanResponsePayload({
        debugVersion: DEBUG_VERSION,
        aiPowerVersion: AI_POWER_VERSION,
        cached: false,
        limit: top ?? freshData.limit,
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
      const top = clampTop(Number(searchParams.get("top")));
      const responseStocks = selectStocks(cacheData.stocks, top);

      return NextResponse.json(
        buildScanResponsePayload({
          debugVersion: DEBUG_VERSION,
          aiPowerVersion: AI_POWER_VERSION,
          cached: true,
          fallback: true,
          limit: top ?? cacheData.limit,
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