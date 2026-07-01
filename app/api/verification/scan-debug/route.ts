import { NextResponse } from "next/server";
import { STOCKS, type Stock } from "@/app/lib/stockList";

export const dynamic = "force-dynamic";

type DebugResult = {
  code: string;
  name: string;
  status: "OK" | "FAIL";
  reason: string;
  currentPrice: number | null;
  candleCount: number;
};

function getUniqueStocks(stocks: Stock[]) {
  const map = new Map<string, Stock>();

  for (const stock of stocks) {
    if (!map.has(stock.code)) {
      map.set(stock.code, stock);
    }
  }

  return Array.from(map.values());
}

async function checkYahooChart(stock: Stock): Promise<DebugResult> {
  try {
    const symbol = `${stock.code}.T`;

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

    if (!res.ok) {
      return {
        code: stock.code,
        name: stock.name,
        status: "FAIL",
        reason: `YAHOO_HTTP_${res.status}`,
        currentPrice: null,
        candleCount: 0,
      };
    }

    const data = await res.json();
    const result = data.chart?.result?.[0];

    if (!result) {
      return {
        code: stock.code,
        name: stock.name,
        status: "FAIL",
        reason: "YAHOO_NO_RESULT",
        currentPrice: null,
        candleCount: 0,
      };
    }

    const timestamps: number[] = result.timestamp ?? [];
    const quote = result.indicators?.quote?.[0];

    if (!quote) {
      return {
        code: stock.code,
        name: stock.name,
        status: "FAIL",
        reason: "YAHOO_NO_QUOTE",
        currentPrice: null,
        candleCount: 0,
      };
    }

    const candles = timestamps
      .map((time: number, index: number) => ({
        time,
        open: quote.open?.[index],
        high: quote.high?.[index],
        low: quote.low?.[index],
        close: quote.close?.[index],
        volume: quote.volume?.[index],
      }))
      .filter((item: any) => item.close)
      .slice(-60);

    const closes = candles.map((candle: any) => candle.close);
    const currentPrice = closes[closes.length - 1] ?? null;

    if (candles.length === 0) {
      return {
        code: stock.code,
        name: stock.name,
        status: "FAIL",
        reason: "NO_CANDLES",
        currentPrice: null,
        candleCount: 0,
      };
    }

    if (currentPrice === null) {
      return {
        code: stock.code,
        name: stock.name,
        status: "FAIL",
        reason: "CURRENT_PRICE_NULL",
        currentPrice: null,
        candleCount: candles.length,
      };
    }

    return {
      code: stock.code,
      name: stock.name,
      status: "OK",
      reason: "OK",
      currentPrice,
      candleCount: candles.length,
    };
  } catch (error) {
    return {
      code: stock.code,
      name: stock.name,
      status: "FAIL",
      reason: error instanceof Error ? error.message : String(error),
      currentPrice: null,
      candleCount: 0,
    };
  }
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

  const { searchParams } = new URL(req.url);
  const limit = Number(searchParams.get("limit") || 1000);
  const batchSize = Number(searchParams.get("batchSize") || 20);

  const uniqueStocks = getUniqueStocks(STOCKS).slice(0, limit);

  const results = await runInBatches(
    uniqueStocks,
    batchSize,
    checkYahooChart
  );

  const okStocks = results.filter((item) => item.status === "OK");
  const failedStocks = results.filter((item) => item.status === "FAIL");

  const reasonSummary = failedStocks.reduce<Record<string, number>>(
    (acc, item) => {
      acc[item.reason] = (acc[item.reason] || 0) + 1;
      return acc;
    },
    {}
  );

  return NextResponse.json({
    success: true,
    checkedAt: new Date().toISOString(),
    limit,
    batchSize,
    total: results.length,
    okCount: okStocks.length,
    failCount: failedStocks.length,
    reasonSummary,
    failedStocks,
    scanMs: Date.now() - startedAt,
  });
}