import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.pathname.split("/").pop() || "";
  const symbol = `${code}.T`;

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
        symbol
      )}?range=1d&interval=1m`
    );

    const data = await res.json();
    const result = data.chart?.result?.[0];

    const price =
      result?.meta?.regularMarketPrice ??
      result?.meta?.previousClose ??
      null;

    return NextResponse.json({
      success: true,
      code,
      symbol,
      price,
      currency: result?.meta?.currency ?? "JPY",
      marketState: result?.meta?.marketState ?? null,
      previousClose: result?.meta?.previousClose ?? null,
    });
  } catch {
    return NextResponse.json({
      success: false,
      code,
      symbol,
      price: null,
    });
  }
}