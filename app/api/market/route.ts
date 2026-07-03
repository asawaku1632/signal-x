import { NextResponse } from "next/server";

type MarketSymbol = {
  key: "nikkei" | "topix" | "usdJpy" | "vix";
  symbol: string;
};

const symbols: MarketSymbol[] = [
  { key: "nikkei", symbol: "^N225" },
  { key: "topix", symbol: "998405.T" },
  { key: "usdJpy", symbol: "JPY=X" },
  { key: "vix", symbol: "^VIX" },
];

async function fetchMarketPrice(symbol: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?range=5d&interval=1d`;

  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      "User-Agent": "Mozilla/5.0",
    },
  });

  if (!res.ok) {
    return null;
  }

  const json = await res.json();

  const result = json.chart?.result?.[0];

  if (!result) {
    return null;
  }

  const metaPrice = result.meta?.regularMarketPrice;

  if (
    typeof metaPrice === "number" &&
    Number.isFinite(metaPrice)
  ) {
    return Number(metaPrice.toFixed(2));
  }

  const closes =
    result.indicators?.quote?.[0]?.close ?? [];

  const latest = [...closes]
    .reverse()
    .find(
      (value: any) =>
        typeof value === "number"
    );

  if (typeof latest === "number") {
    return Number(latest.toFixed(2));
  }

  return null;
}

export async function GET() {
  try {
    const results = await Promise.all(
      symbols.map(async (item) => ({
        key: item.key,
        value: await fetchMarketPrice(item.symbol),
      }))
    );

    const market = Object.fromEntries(
      results.map((item) => [
        item.key,
        item.value,
      ])
    ) as {
      nikkei: number | null;
      topix: number | null;
      usdJpy: number | null;
      vix: number | null;
    };

    return NextResponse.json({
      success: true,

      nikkei: market.nikkei,
      topix: market.topix,
      usdJpy: market.usdJpy,
      vix: market.vix,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ??
          String(error),
      },
      {
        status: 500,
      }
    );
  }
}