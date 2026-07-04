import { NextRequest, NextResponse } from "next/server";
import pool from "@/app/lib/postgres";

export async function GET(req: NextRequest) {
  const startedAt = Date.now();

  try {
    const url = new URL(req.url);
    const baseUrl = url.origin;

    const timeSlot =
      url.searchParams.get("time") ??
      new Date().toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

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
      await pool.query(
        `
        INSERT INTO time_learning_logs (
          trade_date,
          time_slot,
          stock_code,
          stock_name,
          ai_power,
          entry_price,
          result
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,'PENDING'
        )
        ON CONFLICT (
          trade_date,
          time_slot,
          stock_code
        )
        DO UPDATE SET
          stock_name = EXCLUDED.stock_name,
          ai_power = EXCLUDED.ai_power,
          entry_price = EXCLUDED.entry_price,
          result = 'PENDING'
        `,
        [
          today,
          timeSlot,
          stock.code,
          stock.name,
          Number(stock.aiPower ?? stock.score ?? 0),
          Number(stock.price ?? stock.currentPrice ?? 0),
        ]
      );

      saved++;
    }

    return NextResponse.json({
      success: true,
      aiPowerVersion: "V13.9_TIME_SAVE_WITH_ENTRY_PRICE",
      learningDate: today,
      timeSlot,
      saved,
      stockCount: stocks.length,
      apiTimeMs: Date.now() - startedAt,
    });
  } catch (error) {
    console.error("time save error:", error);

    return NextResponse.json(
      {
        success: false,
        aiPowerVersion: "V13.9_TIME_SAVE_WITH_ENTRY_PRICE",
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}