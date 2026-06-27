import { NextResponse } from "next/server";
import { STOCKS, type Stock } from "@/app/lib/stockList";
import { calculateAiScore, type ChartAnalysis } from "@/app/lib/aiEngine";

export const dynamic = "force-dynamic";

const DEBUG_VERSION = "AI_ENGINE_SPLIT_0627";

type CacheData = {
  timestamp: number;
  limit: number;
  stocks: any[];
};

let cacheData: CacheData | null = null;

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

async function fetchYahooChart(code: string): Promise<ChartAnalysis | null> {
  const symbol = `${code}.T`;

  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol
    )}?range=1d&interval=5m`,
    {
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    }
  );

  if (!res.ok) return null;

  const data = await res.json();
  const result = data.chart?.result?.[0];

  if (!result) return null;

  const timestamps: number[] = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0];

  const candles = timestamps
    .map((time: number, index: number) => ({
      time,
      open: quote?.open?.[index],
      high: quote?.high?.[index],
      low: quote?.low?.[index],
      close: quote?.close?.[index],
      volume: quote?.volume?.[index],
    }))
    .filter((item: any) => item.close)
    .slice(-60);

  const closes = candles.map((candle: any) => candle.close);
  const currentPrice = closes[closes.length - 1] ?? null;

  const ma20 =
    closes.length >= 20
      ? closes.slice(-20).reduce((sum: number, value: number) => {
          return sum + value;
        }, 0) / 20
      : null;

  const trend =
    ma20 === null || currentPrice === null
      ? "NO_DATA"
      : currentPrice > ma20
      ? "UPTREND"
      : "DOWNTREND";

  const prev = candles[candles.length - 2];
  const last = candles[candles.length - 1];

  let candleSignal = "NONE";
  let patternSignal = "NONE";
  let patternScore = 0;
  const patternReasons: string[] = [];

  if (prev && last) {
    const prevBear = prev.close < prev.open;
    const prevBull = prev.close > prev.open;
    const lastBear = last.close < last.open;
    const lastBull = last.close > last.open;

    const bullishEngulfing =
      prevBear &&
      lastBull &&
      last.open <= prev.close &&
      last.close >= prev.open;

    const bearishEngulfing =
      prevBull &&
      lastBear &&
      last.open >= prev.close &&
      last.close <= prev.open;

    if (bullishEngulfing) {
      candleSignal = "BULLISH_ENGULFING";
      patternScore += 15;
      patternReasons.push("買い包み足を検出");
    }

    if (bearishEngulfing) {
      candleSignal = "BEARISH_ENGULFING";
      patternScore -= 15;
      patternReasons.push("売り包み足を検出");
    }
  }

  if (trend === "UPTREND") {
    patternScore += 10;
    patternReasons.push("現在価格がMA20より上");
  }

  if (trend === "DOWNTREND") {
    patternScore -= 10;
    patternReasons.push("現在価格がMA20より下");
  }

  if (candles.length >= 20 && currentPrice !== null) {
    const recent = candles.slice(-20);

    const firstHalf = recent.slice(0, 10);
    const secondHalf = recent.slice(10, 20);

    const firstLow = Math.min(...firstHalf.map((c: any) => c.low));
    const secondLow = Math.min(...secondHalf.map((c: any) => c.low));

    const firstLowIndex = firstHalf.findIndex((c: any) => c.low === firstLow);

    const secondLowIndex =
      secondHalf.findIndex((c: any) => c.low === secondLow) + 10;

    const lowsClose = Math.abs(firstLow - secondLow) / currentPrice < 0.015;

    const middleHigh = Math.max(
      ...recent.slice(firstLowIndex, secondLowIndex).map((c: any) => c.high)
    );

    const necklineBreak = currentPrice > middleHigh * 0.998;
    const bouncedFromSecondLow = currentPrice > secondLow * 1.008;

    if (lowsClose && bouncedFromSecondLow) {
      patternSignal = "W_BOTTOM";
      patternScore += 25;
      patternReasons.push("Wボトム候補を検出");
    }

    if (lowsClose && bouncedFromSecondLow && necklineBreak) {
      patternSignal = "W_BOTTOM_BREAK";
      patternScore += 20;
      patternReasons.push("ネックライン付近まで回復");
    }
  }

  return {
    success: true,
    currentPrice,
    ma20: ma20 === null ? null : Number(ma20.toFixed(2)),
    trend,
    candleSignal,
    patternSignal,
    patternScore,
    patternReasons,
    candles,
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

    const rawResults = await runInBatches(targetStocks, 20, async (stock) => {
      const chart = await fetchYahooChart(stock.code);

      if (!chart?.currentPrice) return null;

      return calculateAiScore({
        code: stock.code,
        name: stock.name,
        price: chart.currentPrice,
        previousClose: chart.candles?.[0]?.open ?? null,
        chart,
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
      batchSize: 20,
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