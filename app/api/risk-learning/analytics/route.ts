import { NextResponse } from "next/server";
import pool from "@/app/lib/postgres";

function getRiskBand(riskScore: number) {
  if (riskScore >= 81) return "RISK_EXTREME";
  if (riskScore >= 61) return "RISK_HIGH";
  if (riskScore >= 41) return "RISK_NORMAL";
  if (riskScore >= 21) return "RISK_LOW";
  return "RISK_SAFE";
}

function getRiskLabel(riskBand: string) {
  switch (riskBand) {
    case "RISK_EXTREME":
      return "超危険";
    case "RISK_HIGH":
      return "危険";
    case "RISK_NORMAL":
      return "普通";
    case "RISK_LOW":
      return "低リスク";
    case "RISK_SAFE":
      return "安全";
    default:
      return riskBand;
  }
}

function calculateBonus(winRate: number, judged: number, avgRiskScore: number) {
  if (judged < 10) return 0;

  let bonus = 0;

  if (winRate >= 90) bonus += 8;
  else if (winRate >= 80) bonus += 5;
  else if (winRate >= 70) bonus += 3;
  else if (winRate >= 60) bonus += 1;
  else if (winRate >= 45) bonus += 0;
  else if (winRate >= 35) bonus -= 2;
  else if (winRate >= 25) bonus -= 5;
  else bonus -= 8;

  if (avgRiskScore >= 80) bonus -= 5;
  else if (avgRiskScore >= 60) bonus -= 3;
  else if (avgRiskScore <= 25) bonus += 2;

  return Math.max(-10, Math.min(10, bonus));
}

function calculateConfidence(judged: number) {
  if (judged >= 300) return 100;
  if (judged >= 100) return 80;
  if (judged >= 30) return 60;
  if (judged >= 10) return 40;
  return 0;
}

function getRankLabel(index: number) {
  if (index === 0) return "🥇";
  if (index === 1) return "🥈";
  if (index === 2) return "🥉";
  return `${index + 1}位`;
}

export async function GET() {
  try {
    const { rows } = await pool.query(`
      SELECT
        risk_score,
        result,
        take_profit_hit,
        stop_loss_hit,
        ai_power
      FROM risk_learning_logs
      WHERE result != 'PENDING'
    `);

    const map = new Map<
      string,
      {
        riskBand: string;
        riskLabel: string;
        total: number;
        win: number;
        lose: number;
        hold: number;
        takeProfitHit: number;
        stopLossHit: number;
        riskScoreSum: number;
        aiPowerSum: number;
      }
    >();

    for (const row of rows) {
      const riskScore = Number(row.risk_score ?? 0);
      const riskBand = getRiskBand(riskScore);
      const riskLabel = getRiskLabel(riskBand);

      if (!map.has(riskBand)) {
        map.set(riskBand, {
          riskBand,
          riskLabel,
          total: 0,
          win: 0,
          lose: 0,
          hold: 0,
          takeProfitHit: 0,
          stopLossHit: 0,
          riskScoreSum: 0,
          aiPowerSum: 0,
        });
      }

      const item = map.get(riskBand)!;

      item.total++;
      item.riskScoreSum += riskScore;
      item.aiPowerSum += Number(row.ai_power ?? 0);

      if (row.result === "WIN") item.win++;
      if (row.result === "LOSE") item.lose++;
      if (row.result === "HOLD") item.hold++;
      if (row.take_profit_hit) item.takeProfitHit++;
      if (row.stop_loss_hit) item.stopLossHit++;
    }

    const ranking = Array.from(map.values())
      .map((item) => {
        const judged = item.total;
        const winRate =
          judged > 0
            ? Number(((item.win / judged) * 100).toFixed(2))
            : 0;

        const averageRiskScore =
          judged > 0
            ? Number((item.riskScoreSum / judged).toFixed(2))
            : 0;

        const averageAiPower =
          judged > 0
            ? Number((item.aiPowerSum / judged).toFixed(2))
            : 0;

        return {
          riskBand: item.riskBand,
          riskLabel: item.riskLabel,
          total: judged,
          judged,
          win: item.win,
          lose: item.lose,
          hold: item.hold,
          winRate,
          takeProfitHit: item.takeProfitHit,
          stopLossHit: item.stopLossHit,
          takeProfitRate:
            judged > 0
              ? Number(((item.takeProfitHit / judged) * 100).toFixed(2))
              : 0,
          stopLossRate:
            judged > 0
              ? Number(((item.stopLossHit / judged) * 100).toFixed(2))
              : 0,
          averageRiskScore,
          averageAiPower,
          aiBonus: calculateBonus(winRate, judged, averageRiskScore),
          confidence: calculateConfidence(judged),
        };
      })
      .sort((a, b) => {
        if (a.averageRiskScore !== b.averageRiskScore) {
          return a.averageRiskScore - b.averageRiskScore;
        }
        return b.winRate - a.winRate;
      })
      .map((item, index) => ({
        rank: index + 1,
        rankLabel: getRankLabel(index),
        ...item,
      }));

    return NextResponse.json({
      success: true,
      aiPowerVersion: "V13.13_RISK_ANALYTICS",
      riskBandCount: ranking.length,
      ranking,
    });
  } catch (error) {
    console.error("risk analytics error:", error);

    return NextResponse.json(
      {
        success: false,
        aiPowerVersion: "V13.13_RISK_ANALYTICS",
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}