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

function calculateRiskScore(params: {
  aiPower: number;
  changePercent: number;
  drawdownPercent: number;
  stopLossHit: boolean;
  takeProfitHit: boolean;
}) {
  const {
    aiPower,
    changePercent,
    drawdownPercent,
    stopLossHit,
    takeProfitHit,
  } = params;

  let riskScore = 50;

  if (aiPower >= 85) riskScore -= 15;
  else if (aiPower >= 70) riskScore -= 8;
  else if (aiPower <= 40) riskScore += 15;

  if (changePercent <= -5) riskScore += 25;
  else if (changePercent <= -3) riskScore += 18;
  else if (changePercent <= -2) riskScore += 12;

  if (drawdownPercent <= -5) riskScore += 25;
  else if (drawdownPercent <= -3) riskScore += 15;
  else if (drawdownPercent <= -2) riskScore += 8;

  if (stopLossHit) riskScore += 20;
  if (takeProfitHit) riskScore -= 10;

  return Math.max(0, Math.min(100, Math.round(riskScore)));
}

export async function GET(req: NextRequest) {
  const startedAt = Date.now();

  try {
    const baseUrl = new URL(req.url).origin;

    const scanRes = await fetch(`${baseUrl}/api/scan?limit=1000`, {
      cache: "no-store",
    });

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
        ai_power,
        entry_price
      FROM risk_learning_logs
      WHERE result = 'PENDING'
      ORDER BY trade_date ASC
      LIMIT 5000
    `);

    let updated = 0;
    let skipped = 0;
    let win = 0;
    let lose = 0;
    let hold = 0;
    let takeProfitHitCount = 0;
    let stopLossHitCount = 0;

    for (const row of rows) {
      const currentPrice = priceMap.get(String(row.stock_code)) ?? 0;
      const entryPrice = Number(row.entry_price ?? 0);
      const aiPower = Number(row.ai_power ?? 0);

      if (!entryPrice || !currentPrice) {
        skipped++;
        continue;
      }

      const changePercent =
        ((currentPrice - entryPrice) / entryPrice) * 100;

      const drawdownPercent =
        changePercent < 0 ? changePercent : 0;

      const takeProfitHit = changePercent >= 2;
      const stopLossHit = changePercent <= -2;

      const result = judgeResult(entryPrice, currentPrice);

      const riskScore = calculateRiskScore({
        aiPower,
        changePercent,
        drawdownPercent,
        stopLossHit,
        takeProfitHit,
      });

      await pool.query(
        `
        UPDATE risk_learning_logs
        SET
          judged_price = $1,
          change_percent = $2,
          drawdown_percent = $3,
          take_profit_hit = $4,
          stop_loss_hit = $5,
          risk_score = $6,
          result = $7,
          judged_at = NOW()
        WHERE id = $8
        `,
        [
          currentPrice,
          Number(changePercent.toFixed(2)),
          Number(drawdownPercent.toFixed(2)),
          takeProfitHit,
          stopLossHit,
          riskScore,
          result,
          row.id,
        ]
      );

      if (result === "WIN") win++;
      if (result === "LOSE") lose++;
      if (result === "HOLD") hold++;
      if (takeProfitHit) takeProfitHitCount++;
      if (stopLossHit) stopLossHitCount++;

      updated++;
    }

    return NextResponse.json({
      success: true,
      aiPowerVersion: "V13.13_RISK_JUDGE",
      checked: rows.length,
      updated,
      skipped,
      win,
      lose,
      hold,
      takeProfitHitCount,
      stopLossHitCount,
      apiTimeMs: Date.now() - startedAt,
    });
  } catch (error) {
    console.error("risk judge error:", error);

    return NextResponse.json(
      {
        success: false,
        aiPowerVersion: "V13.13_RISK_JUDGE",
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}