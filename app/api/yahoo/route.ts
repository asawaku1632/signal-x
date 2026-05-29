import { NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

export async function GET() {
  try {
    const result = await yahooFinance.quote("7203.T");

    return NextResponse.json({
      success: true,
      code: result.symbol,
      name: result.longName,
      price: result.regularMarketPrice,
      change: result.regularMarketChangePercent,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json({
      success: false,
      error: String(error),
    });
  }
}