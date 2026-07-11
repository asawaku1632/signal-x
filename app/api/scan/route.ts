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

function clampTop(value: number | null) {
  if (value === null || !Number.isFinite(value) || value < 1) {
    return null;
  }

  return Math.min(Math.floor(value), 100);
}

function selectStocks(stocks: any[], top: number | null) {
  return top ? stocks.slice(0, top) : stocks;
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
          marketPattern: cacheData.marketPattern,
          cacheAge: Math.floor((now - cacheData.timestamp) / 1000),
        })
      );
    }

    const scanResult = await runScan(limit);

    cacheData = {
      timestamp: Date.now(),
      limit,
      stocks: scanResult.stocks,
      marketPattern: scanResult.marketPattern,
      totalStockList: scanResult.totalStockList,
    };

    const responseStocks = selectStocks(scanResult.stocks, top);

    return NextResponse.json(
      buildScanResponsePayload({
        debugVersion: DEBUG_VERSION,
        aiPowerVersion: AI_POWER_VERSION,
        cached: false,
        limit: top ?? scanResult.limit,
        totalStockList: scanResult.totalStockList,
        stocks: responseStocks,
        marketPattern: scanResult.marketPattern,
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
          totalStockList: cacheData.totalStockList,
          stocks: responseStocks,
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