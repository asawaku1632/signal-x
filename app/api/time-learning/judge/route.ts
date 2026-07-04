import { NextRequest, NextResponse } from "next/server";
import pool from "@/app/lib/postgres";

function judgeResult(
  entryPrice: number,
  currentPrice: number
): "WIN" | "LOSE" | "HOLD" {
  if (!entryPrice || !currentPrice) return "HOLD";

  const changePercent =
    ((currentPrice - entryPrice) / entryPrice) * 100;

  if (changePercent >= 2) return "WIN";
  if (changePercent <= -2) return "LOSE";
  return "HOLD";
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

    const priceMap = new Map<string, number>();

    for (const stock of scanData.stocks ?? []) {
      priceMap.set(
        String(stock.code),
        Number(stock.price ?? stock.currentPrice ?? 0)
      );
    }

    const { rows } = await pool.query(`
      SELECT
        id,
        stock_code,
        entry_price,
        result
      FROM time_learning_logs
      WHERE result = 'PENDING'
      ORDER BY trade_date ASC, time_slot ASC
      LIMIT 5000
    `);

    let updated = 0;
    let skipped = 0;
    let win = 0;
    let lose = 0;
    let hold = 0;

    for (const row of rows) {
      const currentPrice = priceMap.get(String(row.stock_code)) ?? 0;
      const entryPrice = Number(row.entry_price ?? 0);

      if (!entryPrice || !currentPrice) {
        skipped++;
        continue;
      }

      const changePercent =
        ((currentPrice - entryPrice) / entryPrice) * 100;

      const result = judgeResult(entryPrice, currentPrice);

      await pool.query(
        `
        UPDATE time_learning_logs
        SET
          judged_price = $1,
          change_percent = $2,
          result = $3,
          judged_at = NOW()
        WHERE id = $4
        `,
        [
          currentPrice,
          Number(changePercent.toFixed(2)),
          result,
          row.id,
        ]
      );

      if (result === "WIN") win++;
      if (result === "LOSE") lose++;
      if (result === "HOLD") hold++;

      updated++;
    }

    return NextResponse.json({
      success: true,
      aiPowerVersion: "V13.9_TIME_JUDGE",
      checked: rows.length,
      updated,
      skipped,
      win,
      lose,
      hold,
      apiTimeMs: Date.now() - startedAt,
    });
  } catch (error) {
    console.error("time judge error:", error);

    return NextResponse.json(
      {
        success: false,
        aiPowerVersion: "V13.9_TIME_JUDGE",
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}