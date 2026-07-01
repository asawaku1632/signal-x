import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const TARGET = {
  code: "4449",
  name: "ギフティ",
};

async function fetchYahooChart(
  code: string,
  range: string,
  interval: string
) {
  const symbol = `${code}.T`;

  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol
    )}?range=${range}&interval=${interval}`,
    {
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    }
  );

  if (!res.ok) {
    return {
      ok: false,
      reason: `YAHOO_HTTP_${res.status}`,
      currentPrice: null,
      candleCount: 0,
      candles: [],
    };
  }

  const data = await res.json();
  const result = data.chart?.result?.[0];

  if (!result) {
    return {
      ok: false,
      reason: "YAHOO_NO_RESULT",
      currentPrice: null,
      candleCount: 0,
      candles: [],
    };
  }

  const timestamps: number[] = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0];

  if (!quote) {
    return {
      ok: false,
      reason: "YAHOO_NO_QUOTE",
      currentPrice: null,
      candleCount: 0,
      candles: [],
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
    .filter((item: any) => item.close);

  const closes = candles.map((candle: any) => candle.close);
  const currentPrice = closes[closes.length - 1] ?? null;

  if (candles.length === 0 || currentPrice === null) {
    return {
      ok: false,
      reason: "NO_CANDLES",
      currentPrice: null,
      candleCount: 0,
      candles: [],
    };
  }

  return {
    ok: true,
    reason: "OK",
    currentPrice,
    candleCount: candles.length,
    candles,
  };
}

export async function GET() {
  const intraday = await fetchYahooChart(TARGET.code, "1d", "5m");

  let fallbackDaily = null;

  if (!intraday.ok) {
    fallbackDaily = await fetchYahooChart(TARGET.code, "5d", "1d");
  }

  const final =
    intraday.ok
      ? {
          ok: true,
          source: "intraday",
          price: intraday.currentPrice,
        }
      : fallbackDaily?.ok
      ? {
          ok: true,
          source: "daily_fallback",
          price: fallbackDaily.currentPrice,
        }
      : {
          ok: false,
          source: "none",
          price: null,
        };

  return NextResponse.json({
    success: true,
    target: TARGET,
    intraday: {
      ok: intraday.ok,
      reason: intraday.reason,
      currentPrice: intraday.currentPrice,
      candleCount: intraday.candleCount,
    },
    fallbackDaily: fallbackDaily
      ? {
          ok: fallbackDaily.ok,
          reason: fallbackDaily.reason,
          currentPrice: fallbackDaily.currentPrice,
          candleCount: fallbackDaily.candleCount,
        }
      : null,
    final,
  });
}