import { NextResponse } from "next/server";
import pool from "@/app/lib/postgres";

function calculateBonus(winRate: number, judged: number) {
  if (judged < 10) return 0;

  if (winRate >= 90) return 8;
  if (winRate >= 80) return 5;
  if (winRate >= 70) return 3;
  if (winRate >= 60) return 1;
  if (winRate >= 45) return 0;
  if (winRate >= 35) return -2;
  if (winRate >= 25) return -5;

  return -8;
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
        event_type,
        event_label,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE result='WIN')::int AS win,
        COUNT(*) FILTER (WHERE result='LOSE')::int AS lose,
        COUNT(*) FILTER (WHERE result='HOLD')::int AS hold,
        COUNT(*) FILTER (WHERE result!='PENDING')::int AS judged,
        ROUND(AVG(ai_power),2)::numeric AS average_ai_power
      FROM event_learning_logs
      GROUP BY event_type, event_label
    `);

    const ranking = rows
      .map((row) => {
        const judged = Number(row.judged ?? 0);
        const win = Number(row.win ?? 0);

        const winRate =
          judged > 0
            ? Number(((win / judged) * 100).toFixed(2))
            : 0;

        return {
          eventType: row.event_type,
          eventLabel: row.event_label,
          total: Number(row.total ?? 0),
          judged,
          win,
          lose: Number(row.lose ?? 0),
          hold: Number(row.hold ?? 0),
          pending:
            Number(row.total ?? 0) - judged,
          winRate,
          aiBonus: calculateBonus(winRate, judged),
          confidence: calculateConfidence(judged),
          averageAiPower: Number(
            row.average_ai_power ?? 0
          ),
        };
      })
      .sort((a, b) => {
        if (b.winRate !== a.winRate)
          return b.winRate - a.winRate;

        if (b.confidence !== a.confidence)
          return b.confidence - a.confidence;

        return b.judged - a.judged;
      })
      .map((item, index) => ({
        rank: index + 1,
        rankLabel: getRankLabel(index),
        ...item,
      }));

    return NextResponse.json({
      success: true,
      aiPowerVersion: "V13.11_EVENT_ANALYTICS",
      eventCount: ranking.length,
      ranking,
    });
  } catch (error) {
    console.error("event analytics error:", error);

    return NextResponse.json(
      {
        success: false,
        aiPowerVersion: "V13.11_EVENT_ANALYTICS",
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status: 500,
      }
    );
  }
}