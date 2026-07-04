import { NextRequest, NextResponse } from "next/server";
import pool from "@/app/lib/postgres";

function getVolatilityBand(volatility: number) {
  if (volatility >= 8) return "VOL_EXTREME";
  if (volatility >= 5) return "VOL_HIGH";
  if (volatility >= 3) return "VOL_MIDDLE";
  if (volatility >= 1.5) return "VOL_LOW";
  return "VOL_QUIET";
}

export async function GET(req: NextRequest) {
  const startedAt = Date.now();

  try {
    const url = new URL(req.url);
    const baseUrl = url.origin;

    const scanRes = await fetch(`${baseUrl}/api/scan?limit=1000`, {
      cache: "no-store",
    });

    const scanData = await scanRes.json();

    if (!scanData.success) {
      throw new Error("SCAN_FAILED");
    }

    const stocks = scanData.stocks ?? [];
    const today = new Date().toISOString().slice(0, 10);

    let saved = 0;

    for (const stock of stocks) {
      const price = Number(stock.price ?? stock.currentPrice ?? 0);
      const changePercent = Math.abs(Number(stock.changePercent ?? 0));

      const volatility = Number(changePercent.toFixed(2));
      const volatilityBand = getVolatilityBand(volatility);

      await pool.query(
        `
        INSERT INTO volatility_learning_logs (
          trade_date,
          stock_code,
          stock_name,
          ai_power,
          entry_price,
          volatility,
          volatility_band,
          result
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,'PENDING'
        )
        ON CONFLICT (
          trade_date,
          stock_code
        )
        DO UPDATE SET
          stock_name = EXCLUDED.stock_name,
          ai_power = EXCLUDED.ai_power,
          entry_price = EXCLUDED.entry_price,
          volatility = EXCLUDED.volatility,
          volatility_band = EXCLUDED.volatility_band,
          result = 'PENDING'
        `,
        [
          today,
          stock.code,
          stock.name,
          Number(stock.aiPower ?? stock.score ?? 0),
          price,
          volatility,
          volatilityBand,
        ]
      );

      saved++;
    }

    return NextResponse.json({
      success: true,
      aiPowerVersion: "V13.10_VOLATILITY_SAVE",
      learningDate: today,
      saved,
      stockCount: stocks.length,
      apiTimeMs: Date.now() - startedAt,
    });
  } catch (error) {
    console.error("volatility save error:", error);

    return NextResponse.json(
      {
        success: false,
        aiPowerVersion: "V13.10_VOLATILITY_SAVE",
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}