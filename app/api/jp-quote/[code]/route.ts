import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const apiKey = process.env.FINNHUB_API_KEY;

  const url = new URL(request.url);
  const code = url.pathname.split("/").pop() || "";

  const candidates = [
    code,
    `${code}.T`,
    `${code}.TSE`,
    `${code}.JP`,
  ];

  const results = [];

  for (const symbol of candidates) {
    try {
      const res = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(
          symbol
        )}&token=${apiKey}`
      );

      const data = await res.json();

      results.push({
        symbol,
        price: data.c,
        high: data.h,
        low: data.l,
        open: data.o,
        prevClose: data.pc,
      });
    } catch {
      results.push({
        symbol,
        error: true,
      });
    }
  }

  return NextResponse.json({
    success: true,
    code,
    results,
  });
}