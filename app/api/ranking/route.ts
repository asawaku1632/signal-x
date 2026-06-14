import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const baseUrl = url.origin;

    const res = await fetch(`${baseUrl}/api/scan`, {
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          success: false,
          error: "scan api failed",
          status: res.status,
        },
        { status: 500 }
      );
    }

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
  } catch (error: any) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: "ranking failed",
        message: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}