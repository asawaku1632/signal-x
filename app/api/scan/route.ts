import { NextResponse } from "next/server";
import { STOCKS, type Stock } from "@/app/lib/stockList";

export const dynamic = "force-dynamic";

const DEBUG_VERSION = "YUJI_TEST_0615";





type CacheData = {
  timestamp: number;
  limit: number;
  stocks: any[];
};

let cacheData: CacheData | null = null;

// 今はテスト中なので0秒。
// 確認後に 60 * 1000 に戻す。
const CACHE_TIME = 60 * 1000;

function getUniqueStocks(stocks: Stock[]) {
  const map = new Map<string, Stock>();

  for (const stock of stocks) {
    if (!map.has(stock.code)) {
      map.set(stock.code, stock);
    }
  }

  return Array.from(map.values());
}

function clampLimit(value: number) {
  if (!Number.isFinite(value)) return 200;
  if (value < 1) return 200;
  if (value > 1000) return 1000;
  return value;
}

async function fetchYahooPrice(code: string) {
  const symbol = `${code}.T`;

  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol
    )}?range=1d&interval=1m`,
    { cache: "no-store" }
  );

  const data = await res.json();
  const result = data.chart?.result?.[0];

  const price =
    result?.meta?.regularMarketPrice ??
    result?.meta?.previousClose ??
    null;

  const previousClose = result?.meta?.previousClose ?? null;

  return {
    price,
    previousClose,
    marketState: result?.meta?.marketState ?? null,
  };
}

function judgeStock(params: {
  code: string;
  name: string;
  price: number;
  previousClose: number | null;
}) {
  const { code, name, price, previousClose } = params;

  const changePercent =
    previousClose && previousClose > 0
      ? ((price - previousClose) / previousClose) * 100
      : 0;

  let score = 50;
  const reasons: string[] = [];

  if (changePercent >= 2) {
    score += 25;
    reasons.push("上昇率が強い");
  } else if (changePercent >= 1) {
    score += 15;
    reasons.push("上昇傾向");
  } else if (changePercent <= -2) {
    score -= 20;
    reasons.push("下落が強い");
  } else {
    reasons.push("値動きは通常範囲");
  }

  if (price > 0 && price <= 1000) {
    score += 5;
    reasons.push("10万円以下で100株を狙いやすい");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    code,
    name,
    score,
    price,
    changePercent: Number(changePercent.toFixed(2)),
    rsi: 50,
    volumeRatio: 1,
    reason: reasons.join("・"),
    takeProfit: Math.round(price * 1.03),
    stopLoss: Math.round(price * 0.98),
  };
}

async function runInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>
) {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const settled = await Promise.allSettled(batch.map(fn));

    for (const result of settled) {
      if (result.status === "fulfilled") {
        results.push(result.value);
      }
    }
  }

  return results;
}

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
      return NextResponse.json({
        success: true,
        cached: true,
        debugVersion: DEBUG_VERSION,
        cacheAge: Math.floor((now - cacheData.timestamp) / 1000),
        count: cacheData.stocks.length,
        requestedLimit: limit,
        totalStockList: getUniqueStocks(STOCKS).length,
        stocks: cacheData.stocks,
      });
    }

    const uniqueStocks = getUniqueStocks(STOCKS);
    const targetStocks = uniqueStocks.slice(0, limit);

    const rawResults = await runInBatches(targetStocks, 30, async (stock) => {
      const quote = await fetchYahooPrice(stock.code);

      if (!quote.price) return null;

      return judgeStock({
        code: stock.code,
        name: stock.name,
        price: quote.price,
        previousClose: quote.previousClose,
      });
    });

    const stocks = rawResults
      .filter(Boolean)
      .sort((a: any, b: any) => b.score - a.score);

    cacheData = {
      timestamp: Date.now(),
      limit,
      stocks,
    };

    return NextResponse.json({
      success: true,
      cached: false,
      debugVersion: DEBUG_VERSION,
      count: stocks.length,
      requestedLimit: limit,
      totalStockList: uniqueStocks.length,
      scanMs: Date.now() - startedAt,
      batchSize: 30,
      stocks,
    });
  } catch (error) {
    if (cacheData) {
      return NextResponse.json({
        success: true,
        cached: true,
        fallback: true,
        debugVersion: DEBUG_VERSION,
        error: String(error),
        count: cacheData.stocks.length,
        requestedLimit: cacheData.limit,
        stocks: cacheData.stocks,
      });
    }

    return NextResponse.json(
      {
        success: false,
        cached: false,
        debugVersion: DEBUG_VERSION,
        stocks: [],
        error: String(error),
      },
      { status: 500 }
    );
  }
}