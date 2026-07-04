import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch(
      "http://localhost:3000/api/experience/analytics",
      {
        cache: "no-store",
      }
    );

    const data = await res.json();

    if (!data.success) {
      throw new Error("Analytics API failed");
    }

    const recommendations: any[] = [];

    function evaluate(
      category: string,
      values: Record<
        string,
        {
          winRate: number;
          total: number;
        }
      >
    ) {
      Object.entries(values).forEach(([key, value]) => {
        let recommendedBonus = 0;
        let evaluation = "KEEP";

        if (value.total < 10) {
          evaluation = "NOT_ENOUGH_DATA";
        } else if (value.winRate >= 85) {
          recommendedBonus = 8;
          evaluation = "STRONG_BUY";
        } else if (value.winRate >= 70) {
          recommendedBonus = 5;
          evaluation = "BUY";
        } else if (value.winRate >= 55) {
          recommendedBonus = 2;
          evaluation = "SLIGHT_BUY";
        } else if (value.winRate >= 45) {
          recommendedBonus = 0;
          evaluation = "KEEP";
        } else if (value.winRate >= 30) {
          recommendedBonus = -3;
          evaluation = "WEAK";
        } else {
          recommendedBonus = -8;
          evaluation = "AVOID";
        }

        recommendations.push({
          category,
          key,
          winRate: value.winRate,
          sampleCount: value.total,
          recommendedBonus,
          evaluation,
        });
      });
    }

    evaluate("RSI", data.analytics.rsi);
    evaluate("MACD", data.analytics.macd);
    evaluate("TREND", data.analytics.trend);

    return NextResponse.json({
      success: true,
      recommendationCount: recommendations.length,
      recommendations,
    });
  } catch (e) {
    console.error(e);

    return NextResponse.json({
      success: false,
    });
  }
}