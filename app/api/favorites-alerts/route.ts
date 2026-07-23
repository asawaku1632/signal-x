import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/app/lib/auth";
import { getFavorites } from "@/app/lib/favorites";

function judgeLabel(score: number) {
  if (score >= 85) return "激熱";
  if (score >= 70) return "本命";
  if (score >= 50) return "静観";
  return "見送り";
}

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email?.trim().toLowerCase();

    if (!userEmail) {
      return NextResponse.json(
        {
          success: false,
          count: 0,
          hotCount: 0,
          alerts: [],
          hotAlerts: [],
          error: "ログインが必要です",
        },
        { status: 401 },
      );
    }

    const favorites = await getFavorites(userEmail);

    const baseUrl = new URL(req.url).origin;

    const scanRes = await fetch(`${baseUrl}/api/scan?limit=1000`, {
      cache: "no-store",
    });

    if (!scanRes.ok) {
      throw new Error(`scan API failed: ${scanRes.status}`);
    }

    const scanJson = await scanRes.json();
    const scanStocks = Array.isArray(scanJson)
      ? scanJson
      : Array.isArray(scanJson.stocks)
        ? scanJson.stocks
        : [];

    const totalStockList =
      Number(scanJson?.totalStockList) || scanStocks.length;

    const alerts = favorites
      .map((favorite) => {
        const stock = scanStocks.find(
          (item: any) => String(item.code) === String(favorite.code),
        );

        if (!stock) {
          return {
            code: favorite.code,
            name: favorite.name,
            score: 0,
            judge: "未取得",
            rank: 0,
            totalRank: totalStockList,
          };
        }

        const score = Number(stock.score ?? stock.aiPower ?? 0);

        const rank =
          scanStocks.findIndex(
            (item: any) => String(item.code) === String(favorite.code),
          ) + 1;

        return {
          code: favorite.code,
          name: favorite.name,
          score,
          judge: judgeLabel(score),
          rank,
          totalRank: totalStockList,
          price: Number(stock.price ?? 0),
          changePercent: Number(stock.changePercent ?? 0),
        };
      })
      .sort((a, b) => b.score - a.score);

    const hotAlerts = alerts.filter((item) => item.score >= 85);

    return NextResponse.json({
      success: true,
      count: alerts.length,
      hotCount: hotAlerts.length,
      totalStockList,
      alerts,
      hotAlerts,
    });
  } catch (error) {
    console.error("GET /api/favorites-alerts error:", error);

    return NextResponse.json(
      {
        success: false,
        count: 0,
        hotCount: 0,
        alerts: [],
        hotAlerts: [],
        error:
          error instanceof Error
            ? error.message
            : "お気に入り通知の取得に失敗しました",
      },
      { status: 500 },
    );
  }
}