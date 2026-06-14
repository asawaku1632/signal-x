import { NextResponse } from "next/server";
import { getNotificationResults } from "@/app/lib/notificationResult";

function getPowerRange(aiPower: number) {
  if (aiPower >= 95) return "95〜100";
  if (aiPower >= 90) return "90〜94";
  if (aiPower >= 85) return "85〜89";
  if (aiPower >= 80) return "80〜84";
  if (aiPower >= 70) return "70〜79";
  if (aiPower >= 50) return "50〜69";
  return "49以下";
}

export async function GET() {
  try {
    const logs = await getNotificationResults();

    const groups: Record<
      string,
      {
        range: string;
        total: number;
        judgedTotal: number;
        win: number;
        lose: number;
        hold: number;
        winRate: number;
      }
    > = {};

    for (const log of logs) {
      const aiPower = log.aiPower ?? log.score ?? 0;
      const range = getPowerRange(aiPower);

      if (!groups[range]) {
        groups[range] = {
          range,
          total: 0,
          judgedTotal: 0,
          win: 0,
          lose: 0,
          hold: 0,
          winRate: 0,
        };
      }

      groups[range].total += 1;

      if (log.result === "WIN") {
        groups[range].win += 1;
        groups[range].judgedTotal += 1;
      } else if (log.result === "LOSE") {
        groups[range].lose += 1;
        groups[range].judgedTotal += 1;
      } else if (log.result === "HOLD") {
        groups[range].hold += 1;
      }
    }

    const ranking = Object.values(groups)
      .map((item) => ({
        ...item,
        winRate:
          item.judgedTotal > 0
            ? Math.round((item.win / item.judgedTotal) * 1000) / 10
            : 0,
      }))
      .sort((a, b) => Number(b.range.split("〜")[0]) - Number(a.range.split("〜")[0]));

    return NextResponse.json({
      success: true,
      count: ranking.length,
      ranking,
    });
  } catch (error: any) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: "power stats failed",
        message: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}