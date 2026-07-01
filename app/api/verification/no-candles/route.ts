import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const NO_CANDLES_STOCKS = [
  { code: "4384", name: "ラクスル" },
  { code: "6201", name: "豊田自動織機" },
  { code: "4974", name: "タカラバイオ" },
  { code: "1726", name: "ビーアールHD" },
  { code: "4449", name: "ギフティ" },
  { code: "4530", name: "久光製薬" },
  { code: "5727", name: "東邦チタニウム" },
  { code: "6670", name: "MCJ" },
  { code: "7088", name: "フォーラムE" },
];

async function checkYahoo(
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
      httpStatus: res.status,
      candleCount: 0,
      currentPrice: null,
      reason: `YAHOO_HTTP_${res.status}`,
    };
  }

  const data = await res.json();
  const result = data.chart?.result?.[0];

  if (!result) {
    return {
      ok: false,
      httpStatus: 200,
      candleCount: 0,
      currentPrice: null,
      reason: "YAHOO_NO_RESULT",
    };
  }

  const timestamps: number[] = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0];

  if (!quote) {
    return {
      ok: false,
      httpStatus: 200,
      candleCount: 0,
      currentPrice: null,
      reason: "YAHOO_NO_QUOTE",
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

  if (candles.length === 0) {
    return {
      ok: false,
      httpStatus: 200,
      candleCount: 0,
      currentPrice: null,
      reason: "NO_CANDLES",
    };
  }

  return {
    ok: true,
    httpStatus: 200,
    candleCount: candles.length,
    currentPrice,
    reason: "OK",
  };
}

export async function GET() {
  const startedAt = Date.now();

  const results = [];

  for (const stock of NO_CANDLES_STOCKS) {
    const intraday = await checkYahoo(stock.code, "1d", "5m");
    const daily = await checkYahoo(stock.code, "5d", "1d");

    let finalReason = "UNKNOWN";

    if (!intraday.ok && daily.ok) {
      finalReason = "INTRADAY_NO_DATA_DAILY_OK";
    } else if (!intraday.ok && !daily.ok) {
      finalReason = "BOTH_INTRADAY_AND_DAILY_NO_DATA";
    } else if (intraday.ok) {
      finalReason = "INTRADAY_OK";
    }

    results.push({
      code: stock.code,
      name: stock.name,
      intraday,
      daily,
      finalReason,
    });
  }

  return NextResponse.json({
    success: true,
    checkedAt: new Date().toISOString(),
    count: results.length,
    results,
    scanMs: Date.now() - startedAt,
  });
}