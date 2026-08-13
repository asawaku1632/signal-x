import { after } from "next/server";
import { NextResponse } from "next/server";
import { clampLimit, getFallbackTotalStockList } from "@/app/lib/learning/scanEngine";
import {
  getLatestScanSnapshot,
  refreshScanSnapshot,
  SCAN_FRESH_MS,
} from "@/app/lib/scanSnapshot";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type MarketFilter = "market-hot" | "market-watch" | null;

function finite(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

// Scan payload is intentionally extensible across AI POWER versions.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function selectStocks(stocks: any[], top: number | null, filter: MarketFilter) {
  const filtered = filter === "market-hot"
    ? stocks.filter((stock) => finite(stock.score ?? stock.aiPower) >= 75)
    : filter === "market-watch"
      ? stocks.filter((stock) => {
          const score = finite(stock.score ?? stock.aiPower);
          return score >= 65 && score < 75;
        })
      : stocks;
  return top ? filtered.slice(0, top) : filtered;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = clampLimit(Number(url.searchParams.get("limit") || 200));
  const requestedTop = Number(url.searchParams.get("top"));
  const top = Number.isFinite(requestedTop) && requestedTop > 0
    ? Math.min(Math.floor(requestedTop), 100)
    : null;
  const rawFilter = url.searchParams.get("filter");
  const filter: MarketFilter = rawFilter === "market-hot" || rawFilter === "market-watch"
    ? rawFilter
    : null;

  let snapshot = await getLatestScanSnapshot();
  const ageMs = snapshot ? Date.now() - Date.parse(snapshot.updatedAt) : Infinity;
  const coversRequest = Boolean(snapshot && snapshot.itemCount >= limit);
  const blockingConsumer = limit > 100 && top === null && filter === null;

  if (blockingConsumer && (!snapshot || ageMs >= SCAN_FRESH_MS || !coversRequest)) {
    await refreshScanSnapshot(Math.max(limit, snapshot?.itemCount ?? 0));
    snapshot = await getLatestScanSnapshot();
  }

  const responseAgeMs = snapshot ? Date.now() - Date.parse(snapshot.updatedAt) : Infinity;
  const responseCoversRequest = Boolean(snapshot && snapshot.itemCount >= limit);

  if (!blockingConsumer && (!snapshot || responseAgeMs >= SCAN_FRESH_MS || !responseCoversRequest)) {
    after(async () => {
      const refreshLimit = Math.max(limit, snapshot?.itemCount ?? 0);
      await refreshScanSnapshot(refreshLimit).catch((error) =>
        console.error("scan snapshot refresh failed:", error),
      );
    });
  }

  if (!snapshot) {
    return NextResponse.json({
      success: true,
      status: "loading",
      cached: false,
      updatedAt: null,
      totalStockList: getFallbackTotalStockList(),
      scannedCount: 0,
      stocks: [],
    }, { status: 202 });
  }

  const sourceStocks = snapshot.payload.stocks.slice(0, limit);
  const stocks = selectStocks(sourceStocks, top, filter);
  return NextResponse.json({
    ...snapshot.payload,
    status: responseAgeMs < SCAN_FRESH_MS && responseCoversRequest ? "fresh" : "stale",
    cached: true,
    cacheAge: Math.max(0, Math.floor(responseAgeMs / 1000)),
    updatedAt: snapshot.updatedAt,
    requestedLimit: top ?? limit,
    count: stocks.length,
    scannedCount: sourceStocks.length,
    stocks,
  });
}
