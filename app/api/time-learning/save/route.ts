import { NextRequest, NextResponse } from "next/server";
import pool from "@/app/lib/postgres";

function getCurrentTimeSlot(now: Date = new Date()) {
  const hh = now.getHours();
  const mm = now.getMinutes();
  const time = hh * 100 + mm;

  if (time >= 900 && time <= 1030) return "09:00-10:30";
  if (time >= 1031 && time <= 1130) return "10:31-11:30";
  if (time >= 1230 && time <= 1400) return "12:30-14:00";
  if (time >= 1401 && time <= 1500) return "14:01-15:00";

  return "OUT_OF_SESSION";
}

export async function GET(req: NextRequest) {
  const startedAt = Date.now();

  try {
    const url = new URL(req.url);
    const baseUrl = url.origin;

    const timeSlot =
      url.searchParams.get("time") ??
      getCurrentTimeSlot();

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
      aiPowerVersion: "V14.2_TIME_SAVE",
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
        aiPowerVersion: "V14.2_TIME_SAVE",
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}