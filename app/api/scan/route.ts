import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

let cache: any[] = [];
let lastFetch = 0;

const CACHE_TIME = 60 * 1000;

export async function GET() {
  const now = Date.now();

  if (
    cache.length > 0 &&
    now - lastFetch < CACHE_TIME
  ) {
    return NextResponse.json({
      success: true,
      cached: true,
      stocks: cache,
    });
  }

  const stocks = [
    {
      code: "7203",
      name: "トヨタ",
      aiPower: 90,
    },
  ];

  cache = stocks;
  lastFetch = now;

  return NextResponse.json({
    success: true,
    cached: false,
    stocks,
  });
}