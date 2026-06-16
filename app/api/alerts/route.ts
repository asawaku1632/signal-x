import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Stock = {
  code: string;
  name: string;
  score?: number;
  aiPower?: number;
  price?: number;
  changePercent?: number;
  takeProfit?: number;
  stopLoss?: number;
  reason?: string;
  patterns?: {
    rapidRise?: boolean;
    rapidDrop?: boolean;
    volumeBreakout?: boolean;
    highBreak?: boolean;
    goldenCross?: boolean;
    deadCross?: boolean;
    lowerWickBounce?: boolean;
    upperWickWarning?: boolean;
    trendFollow?: boolean;
  };
};

function getBaseUrl() {
  return "https://signal-x-hazel.vercel.app";
}

function getScore(stock: Stock) {
  return stock.score ?? stock.aiPower ?? 0;
}

function formatPrice(price?: number) {
  if (!price || !Number.isFinite(price)) return "-";
  return Math.round(price).toLocaleString();
}

function getSignalType(score: number) {
  if (score >= 85) return "🔥 激熱";
  if (score >= 70) return "🟢 強い";
  if (score >= 50) return "🟡 静観";
  return "🔴 見送り";
}

function getColor(score: number) {
  if (score >= 85) return "text-purple-300";
  if (score >= 70) return "text-green-300";
  if (score >= 50) return "text-yellow-300";
  return "text-red-300";
}

function getWinRate(score: number) {
  return Math.min(95, Math.max(40, Math.round(score * 0.9)));
}

export async function GET() {
  try {
    const baseUrl = getBaseUrl();

    const res = await fetch(`${baseUrl}/api/scan?limit=500`, {
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          success: false,
          alerts: [],
          error: "scan api failed",
          status: res.status,
          baseUrl,
        },
        { status: 500 }
      );
    }

    const json = await res.json();
    const stocks: Stock[] = json.stocks || [];
    const totalStockList = json.totalStockList || stocks.length;

    const alerts = stocks
      .map((stock, index) => {
        const score = getScore(stock);
        const price = stock.price ?? 0;
        const requiredCapital = Math.round(price * 100);

        return {
          type: getSignalType(score),
          title: `${stock.code} ${stock.name}`,
          code: stock.code,
          name: stock.name,
          score,
          rank: index + 1,
          totalRank: totalStockList,
          winRate: getWinRate(score),
          price,
          priceText: `${formatPrice(stock.price)}円`,
          requiredCapital,
          requiredCapitalText: `${requiredCapital.toLocaleString()}円`,
          takeProfit: stock.takeProfit ?? 0,
          takeProfitText: `${formatPrice(stock.takeProfit)}円`,
          stopLoss: stock.stopLoss ?? 0,
          stopLossText: `${formatPrice(stock.stopLoss)}円`,
          changePercent: stock.changePercent ?? 0,
          reason: stock.reason || "AIが注目候補として検出",
          color: getColor(score),
        };
      })
      .filter((alert) => alert.score >= 70)
      .slice(0, 30);

    return NextResponse.json({
      success: true,
      alerts,
      count: alerts.length,
      stockCount: stocks.length,
      totalStockList,
      updatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        alerts: [],
        error: "alerts api failed",
        message: error?.message || String(error),
        cause: error?.cause?.message || null,
      },
      { status: 500 }
    );
  }
}