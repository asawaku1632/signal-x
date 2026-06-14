import { NextResponse } from "next/server";
import { getNotificationResults } from "@/app/lib/notificationResult";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    const logs = await getNotificationResults();

    const filtered = logs.filter(
      (log) => log.code === code
    );

    const judged = filtered.filter(
      (log) =>
        log.result === "WIN" ||
        log.result === "LOSE"
    );

    const win = judged.filter(
      (log) => log.result === "WIN"
    ).length;

    const lose = judged.filter(
      (log) => log.result === "LOSE"
    ).length;

    const winRate =
      judged.length > 0
        ? Math.round((win / judged.length) * 100)
        : 0;

    return NextResponse.json({
      success: true,
      code,
      total: filtered.length,
      win,
      lose,
      winRate,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}