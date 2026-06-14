import { NextResponse } from "next/server";

export async function GET() {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      "http://localhost:3000";

    const res = await fetch(`${baseUrl}/api/scan`, {
      cache: "no-store",
    });

    const json = await res.json();
    const stocks = json.stocks || [];

    const ranking = stocks
      .filter((stock: any) => (stock.score ?? 0) >= 50)
      .sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 20);

    return NextResponse.json({
      success: true,
      count: ranking.length,
      ranking,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: "ranking failed",
      },
      {
        status: 500,
      }
    );
  }
}