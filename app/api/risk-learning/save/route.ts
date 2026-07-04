import { NextRequest, NextResponse } from "next/server";
import pool from "@/app/lib/postgres";

function calculateInitialRiskScore(params: {
  aiPower: number;
  changePercent: number;
  volatility: number;
}) {
  const { aiPower, changePercent, volatility } = params;

  let riskScore = 50;

  if (aiPower >= 85) riskScore -= 15;
  else if (aiPower >= 70) riskScore -= 8;
  else if (aiPower <= 40) riskScore += 15;

  if (changePercent <= -3) riskScore += 20;
  else if (changePercent <= -1.5) riskScore += 10;

  if (changePercent >= 5) riskScore += 10;

  if (volatility >= 8) riskScore += 20;
  else if (volatility >= 5) riskScore += 12;
  else if (volatility >= 3) riskScore += 6;

  return Math.max(0, Math.min(100, Math.round(riskScore)));
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
      const aiPower = Number(stock.aiPower ?? stock.score ?? 0);
      const entryPrice = Number(stock.price ?? stock.currentPrice ?? 0);
      const changePercent = Number(stock.changePercent ?? 0);
      const volatility = Math.abs(changePercent);

      const riskScore = calculateInitialRiskScore({
        aiPower,
        changePercent,
        volatility,
      });

      await pool.query(
        `
        INSERT INTO risk_learning_logs (
          trade_date,
          stock_code,
          stock_name,
          ai_power,
          entry_price,
          change_percent,
          drawdown_percent,
          take_profit_hit,
          stop_loss_hit,
          risk_score,
          result
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,0,false,false,$7,'PENDING'
        )
        `,
        [
          today,
          stock.code,
          stock.name,
          aiPower,
          entryPrice,
          changePercent,
          riskScore,
        ]
      );

      saved++;
    }

    return NextResponse.json({
      success: true,
      aiPowerVersion: "V13.13_RISK_SAVE",
      learningDate: today,
      saved,
      stockCount: stocks.length,
      apiTimeMs: Date.now() - startedAt,
    });
  } catch (error) {
    console.error("risk save error:", error);

    return NextResponse.json(
      {
        success: false,
        aiPowerVersion: "V13.13_RISK_SAVE",
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}