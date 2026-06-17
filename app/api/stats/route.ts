import { NextResponse } from "next/server";

import { getNotificationLogs } from "@/app/lib/notificationLog";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const logs = await getNotificationLogs();

    const total = logs.length;

    const win = logs.filter(
      (log) => log.profitNotified === true
    ).length;

    const lose = logs.filter(
      (log) => log.stopLossNotified === true
    ).length;

    const active = logs.filter(
      (log) =>
        !log.profitNotified &&
        !log.stopLossNotified
    ).length;

    const winRate =
      win + lose > 0
        ? Number(
            ((win / (win + lose)) * 100).toFixed(1)
          )
        : 0;

    return NextResponse.json({
      success: true,
      total,
      win,
      lose,
      active,
      winRate,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}