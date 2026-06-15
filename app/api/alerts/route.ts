import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Stock = {
  code: string;
  name: string;
  score?: number;
  aiPower?: number;
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

    const alerts = [];

    for (const stock of stocks) {
      const score = getScore(stock);

      if (score >= 85) {
        alerts.push({
          type: "HOT",
          title: `${stock.name} AI POWER ${score}`,
          message: "Very strong AI signal detected.",
          color: "text-purple-300",
        });
      }

      if (score >= 70 && score < 85) {
        alerts.push({
          type: "STRONG",
          title: `${stock.name} strong candidate`,
          message: "AI monitoring priority is high.",
          color: "text-orange-300",
        });
      }

      if (stock.patterns?.rapidRise) {
        alerts.push({
          type: "RAPID_RISE",
          title: `${stock.name} rapid rise`,
          message: "Short-term strong rise detected.",
          color: "text-green-300",
        });
      }

      if (stock.patterns?.rapidDrop) {
        alerts.push({
          type: "RAPID_DROP",
          title: `${stock.name} rapid drop`,
          message: "Be careful with entry.",
          color: "text-red-300",
        });
      }

      if (stock.patterns?.volumeBreakout) {
        alerts.push({
          type: "VOLUME_BREAKOUT",
          title: `${stock.name} volume breakout`,
          message: "Volume increase detected.",
          color: "text-purple-300",
        });
      }

      if (stock.patterns?.highBreak) {
        alerts.push({
          type: "HIGH_BREAK",
          title: `${stock.name} high break`,
          message: "High breakout signal detected.",
          color: "text-cyan-300",
        });
      }

      if (stock.patterns?.goldenCross) {
        alerts.push({
          type: "GOLDEN_CROSS",
          title: `${stock.name} golden cross`,
          message: "Possible uptrend formation.",
          color: "text-green-300",
        });
      }

      if (stock.patterns?.deadCross) {
        alerts.push({
          type: "DEAD_CROSS",
          title: `${stock.name} dead cross`,
          message: "Downtrend warning.",
          color: "text-red-400",
        });
      }

      if (stock.patterns?.lowerWickBounce) {
        alerts.push({
          type: "LOWER_WICK_BOUNCE",
          title: `${stock.name} bounce candidate`,
          message: "Bounce after decline detected.",
          color: "text-cyan-300",
        });
      }

      if (stock.patterns?.upperWickWarning) {
        alerts.push({
          type: "UPPER_WICK_WARNING",
          title: `${stock.name} upper wick warning`,
          message: "Profit taking pressure warning.",
          color: "text-yellow-300",
        });
      }

      if (stock.patterns?.trendFollow) {
        alerts.push({
          type: "TREND_FOLLOW",
          title: `${stock.name} trend follow`,
          message: "AI detected trend continuation.",
          color: "text-blue-300",
        });
      }
    }

    return NextResponse.json({
      success: true,
      alerts,
      count: alerts.length,
      stockCount: stocks.length,
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