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

export async function GET(req: Request) {
  const startedAt = Date.now();
  const now = Date.now();

  try {
    const { searchParams } = new URL(req.url);
    const limit = clampLimit(Number(searchParams.get("limit") || 200));

    if (
      cacheData &&
      cacheData.limit === limit &&
      now - cacheData.timestamp < CACHE_TIME
    ) {
      return NextResponse.json(
        buildScanResponsePayload({
          debugVersion: DEBUG_VERSION,
          aiPowerVersion: AI_POWER_VERSION,
          cached: true,
          limit,
          totalStockList:
            cacheData.totalStockList ?? getFallbackTotalStockList(),
          stocks: cacheData.stocks,
          marketPattern: cacheData.marketPattern,
          cacheAge: Math.floor((now - cacheData.timestamp) / 1000),
        })
      );
    }

    const scanResult = await runScan(limit);

    cacheData = {
      timestamp: Date.now(),
      limit: scanResult.limit,
      stocks: scanResult.stocks,
      marketPattern: scanResult.marketPattern,
      totalStockList: scanResult.totalStockList,
    };

    return NextResponse.json(
      buildScanResponsePayload({
        debugVersion: DEBUG_VERSION,
        aiPowerVersion: AI_POWER_VERSION,
        cached: false,
        limit: scanResult.limit,
        totalStockList: scanResult.totalStockList,
        stocks: scanResult.stocks,
        marketPattern: scanResult.marketPattern,
        scanMs: Date.now() - startedAt,
      })
    );
  } catch (error) {
    if (cacheData) {
      return NextResponse.json(
        buildScanResponsePayload({
          debugVersion: DEBUG_VERSION,
          aiPowerVersion: AI_POWER_VERSION,
          cached: true,
          fallback: true,
          limit: cacheData.limit,
          totalStockList: cacheData.totalStockList,
          stocks: cacheData.stocks,
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
