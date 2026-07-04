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
        time_slot,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE result = 'WIN')::int AS win,
        COUNT(*) FILTER (WHERE result = 'LOSE')::int AS lose,
        COUNT(*) FILTER (WHERE result = 'HOLD')::int AS hold,
        COUNT(*) FILTER (WHERE result != 'PENDING')::int AS judged,
        ROUND(AVG(ai_power), 2)::numeric AS average_ai_power
      FROM time_learning_logs
      GROUP BY time_slot
      ORDER BY time_slot ASC
    `);

    const timeSlots = rows
      .map((row) => {
        const win = Number(row.win ?? 0);
        const lose = Number(row.lose ?? 0);
        const hold = Number(row.hold ?? 0);
        const judged = Number(row.judged ?? 0);
        const total = Number(row.total ?? 0);

        const winRate =
          judged > 0
            ? Number(((win / judged) * 100).toFixed(2))
            : 0;

        const aiBonus = calculateBonus(winRate, judged);
        const confidence = calculateConfidence(judged);

        return {
          timeSlot: row.time_slot,
          total,
          judged,
          win,
          lose,
          hold,
          pending: total - judged,
          winRate,
          aiBonus,
          confidence,
          averageAiPower: Number(row.average_ai_power ?? 0),
        };
      })
      .sort((a, b) => {
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        if (b.confidence !== a.confidence) return b.confidence - a.confidence;
        return b.judged - a.judged;
      })
      .map((slot, index) => ({
        rank: index + 1,
        rankLabel: getRankLabel(index),
        ...slot,
      }));

    return NextResponse.json({
      success: true,
      aiPowerVersion: "V13.9_TIME_ANALYTICS",
      slotCount: timeSlots.length,
      timeSlots,
    });
  } catch (error) {
    console.error("time analytics error:", error);

    return NextResponse.json(
      {
        success: false,
        aiPowerVersion: "V13.9_TIME_ANALYTICS",
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}