import { NextResponse } from "next/server";
import { getNotificationResults } from "@/app/lib/notificationResult";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const results = await getNotificationResults();

    const total = results.length;

    const win = results.filter((r) => r.result === "WIN").length;
    const lose = results.filter((r) => r.result === "LOSE").length;
    const hold = results.filter((r) => r.result === "HOLD").length;
    const unknown = results.filter((r) => r.result === "UNKNOWN").length;

    const judgedTotal = win + lose;

    const winRate =
      judgedTotal > 0
        ? Math.round((win / judgedTotal) * 100)
        : 0;

    return NextResponse.json({
      success: true,
      total,
      judgedTotal,
      win,
      lose,
      hold,
      unknown,
      winRate,
      message:
        total === 0
          ? "まだ検証データがありません"
          : `現在の勝率は${winRate}%です`,
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
