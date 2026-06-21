import { NextResponse } from "next/server";
import { getFavorites } from "@/app/lib/favorites";

function judgeLabel(score: number) {
  if (score >= 85) return "激熱";
  if (score >= 70) return "本命";
  if (score >= 50) return "静観";
  return "見送り";
}

export async function GET(req: Request) {
  try {
    const favorites = await getFavorites();

    const baseUrl = new URL(req.url).origin;

    const scanRes = await fetch(`${baseUrl}/api/scan?limit=1000`, {
      cache: "no-store",
    });

    const scanJson = await scanRes.json();
    const scanStocks = scanJson.stocks || [];

    const alerts = favorites
      .map((favorite) => {
        const stock = scanStocks.find(
          (item: any) => item.code === favorite.code
        );

        if (!stock) {
          return {
            code: favorite.code,
            name: favorite.name,
            score: 0,
            judge: "未取得",
            rank: 0,
            totalRank: scanJson.totalStockList || scanStocks.length,
          };
        }

        const rank =
          scanStocks.findIndex(
            (item: any) => item.code === favorite.code
          ) + 1;

        return {
          code: favorite.code,
          name: favorite.name,
          score: stock.score,
          judge: judgeLabel(stock.score),
          rank,
          totalRank: scanJson.totalStockList || scanStocks.length,
          price: stock.price,
          changePercent: stock.changePercent,
        };
      })
      .sort((a, b) => b.score - a.score);

    const hotAlerts = alerts.filter((item) => item.score >= 85);

    return NextResponse.json({
      success: true,
      count: alerts.length,
      hotCount: hotAlerts.length,
      totalStockList: scanJson.totalStockList || scanStocks.length,
      alerts,
      hotAlerts,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        count: 0,
        hotCount: 0,
        alerts: [],
        hotAlerts: [],
        error: String(error),
      },
      { status: 500 }
    );
  }
}