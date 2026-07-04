import { NextRequest, NextResponse } from "next/server";

type MarketPattern =
  | "BULLISH"
  | "SLIGHTLY_BULLISH"
  | "NEUTRAL"
  | "SLIGHTLY_BEARISH"
  | "BEARISH";

function getPatternLabel(pattern: MarketPattern) {
  switch (pattern) {
    case "BULLISH":
      return "強気相場";
    case "SLIGHTLY_BULLISH":
      return "やや強気";
    case "NEUTRAL":
      return "横ばい";
    case "SLIGHTLY_BEARISH":
      return "やや弱気";
    case "BEARISH":
      return "弱気相場";
  }
}

function getPatternEmoji(pattern: MarketPattern) {
  switch (pattern) {
    case "BULLISH":
      return "🟢";
    case "SLIGHTLY_BULLISH":
      return "🟩";
    case "NEUTRAL":
      return "🟡";
    case "SLIGHTLY_BEARISH":
      return "🟧";
    case "BEARISH":
      return "🔴";
  }
}

function judgeMarketPattern(params: {
  averageAiPower: number;
  risingCount: number;
  fallingCount: number;
  strongCount: number;
  dangerCount: number;
  total: number;
}): MarketPattern {
  const {
    averageAiPower,
    risingCount,
    fallingCount,
    strongCount,
    dangerCount,
    total,
  } = params;

  const risingRate = total > 0 ? risingCount / total : 0;
  const fallingRate = total > 0 ? fallingCount / total : 0;
  const strongRate = total > 0 ? strongCount / total : 0;
  const dangerRate = total > 0 ? dangerCount / total : 0;

  if (
    averageAiPower >= 70 &&
    risingRate >= 0.45 &&
    strongRate >= 0.2
  ) {
    return "BULLISH";
  }

  if (
    averageAiPower >= 60 &&
    risingRate > fallingRate &&
    strongRate >= 0.12
  ) {
    return "SLIGHTLY_BULLISH";
  }

  if (
    averageAiPower <= 40 ||
    fallingRate >= 0.5 ||
    dangerRate >= 0.55
  ) {
    return "BEARISH";
  }

  if (
    averageAiPower <= 50 ||
    dangerRate >= 0.4 ||
    fallingRate > risingRate
  ) {
    return "SLIGHTLY_BEARISH";
  }

  return "NEUTRAL";
}

export async function GET(req: NextRequest) {
  const startedAt = Date.now();

  try {
    const baseUrl = new URL(req.url).origin;

    const scanRes = await fetch(
      `${baseUrl}/api/scan?limit=1000`,
      {
        cache: "no-store",
      }
    );

    const scanData = await scanRes.json();

    if (!scanData.success) {
      throw new Error("SCAN_FAILED");
    }

    const stocks = scanData.stocks ?? [];
    const total = stocks.length;

    let aiPowerSum = 0;
    let risingCount = 0;
    let fallingCount = 0;
    let neutralCount = 0;
    let strongCount = 0;
    let dangerCount = 0;

    for (const stock of stocks) {
      const aiPower = Number(stock.aiPower ?? stock.score ?? 0);
      const changePercent = Number(stock.changePercent ?? 0);

      aiPowerSum += aiPower;

      if (changePercent >= 1) {
        risingCount++;
      } else if (changePercent <= -1) {
        fallingCount++;
      } else {
        neutralCount++;
      }

      if (aiPower >= 70) {
        strongCount++;
      }

      if (aiPower <= 49) {
        dangerCount++;
      }
    }

    const averageAiPower =
      total > 0 ? Number((aiPowerSum / total).toFixed(2)) : 0;

    const marketPattern = judgeMarketPattern({
      averageAiPower,
      risingCount,
      fallingCount,
      strongCount,
      dangerCount,
      total,
    });

    return NextResponse.json({
      success: true,
      aiPowerVersion: "V13.8_MARKET_PATTERN_AI",
      marketPattern,
      label: getPatternLabel(marketPattern),
      emoji: getPatternEmoji(marketPattern),

      summary: {
        total,
        averageAiPower,
        risingCount,
        fallingCount,
        neutralCount,
        strongCount,
        dangerCount,
        risingRate:
          total > 0
            ? Number(((risingCount / total) * 100).toFixed(1))
            : 0,
        fallingRate:
          total > 0
            ? Number(((fallingCount / total) * 100).toFixed(1))
            : 0,
        strongRate:
          total > 0
            ? Number(((strongCount / total) * 100).toFixed(1))
            : 0,
        dangerRate:
          total > 0
            ? Number(((dangerCount / total) * 100).toFixed(1))
            : 0,
      },

      source: {
        scanSuccess: scanData.success,
        scanVersion: scanData.aiPowerVersion,
        debugVersion: scanData.debugVersion,
        count: scanData.count,
        requestedLimit: scanData.requestedLimit,
        totalStockList: scanData.totalStockList,
      },

      apiTimeMs: Date.now() - startedAt,
    });
  } catch (error) {
    console.error("market pattern error:", error);

    return NextResponse.json(
      {
        success: false,
        aiPowerVersion: "V13.8_MARKET_PATTERN_AI",
        error:
          error instanceof Error
            ? error.message
            : String(error),
        apiTimeMs: Date.now() - startedAt,
      },
      { status: 500 }
    );
  }
}