import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  context: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await context.params;
  const apiKey = process.env.FINNHUB_API_KEY;

  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(
        symbol
      )}&token=${apiKey}`
    );

    const data = await res.json();

    return NextResponse.json({
      success: true,
      symbol,
      price: data.c,
      high: data.h,
      low: data.l,
      open: data.o,
      prevClose: data.pc,
    });
  } catch {
    return NextResponse.json({
      success: false,
      symbol: "unknown",
      price: null,
    });
  }
}