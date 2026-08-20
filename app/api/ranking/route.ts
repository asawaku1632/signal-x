import { NextResponse } from "next/server";

type RankingStock = {
  score?: number;
  [key: string]: unknown;
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const baseUrl = url.origin;

    const res = await fetch(`${baseUrl}/api/scan?limit=1200`, {
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
    const stocks: RankingStock[] = json.stocks || [];
    const rankingUniverseCount = Number.isFinite(
      Number(json.scanDiagnostics?.analyzedSuccessCount),
    )
      ? Number(json.scanDiagnostics.analyzedSuccessCount)
      : stocks.length;

    const ranking = stocks
      .filter((stock) => (stock.score ?? 0) >= 50)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 20);

    return NextResponse.json({
      success: true,
      count: ranking.length,
      ranking,
      rankingUniverseCount,
      activeStockCount: Number(json.totalStockList) || null,
      rankingCount: ranking.length,
      snapshotUpdatedAt: json.updatedAt ?? null,
    });
  } catch (error: unknown) {
    console.error(error);

    const message = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        success: false,
        error: "ranking failed",
        message,
      },
      { status: 500 }
    );
  }
}
