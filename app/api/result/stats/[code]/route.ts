import { NextResponse } from "next/server";
import { getNotificationResults } from "@/app/lib/notificationResult";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    code: string;
  }>;
};

export async function GET(
  _req: Request,
  context: RouteContext
) {
  try {
    const { code } = await context.params;

    const results = await getNotificationResults();

    const filtered = results.filter(
      (r) => r.code === code
    );

    const total = filtered.length;
    const win = filtered.filter((r) => r.result === "WIN").length;
    const lose = filtered.filter((r) => r.result === "LOSE").length;
    const hold = filtered.filter((r) => r.result === "HOLD").length;
    const unknown = filtered.filter((r) => r.result === "UNKNOWN").length;

    const judgedTotal = win + lose;

    const winRate =
      judgedTotal > 0
        ? Math.round((win / judgedTotal) * 100)
        : 0;

    return NextResponse.json({
      success: true,
      code,
      total,
      judgedTotal,
      win,
      lose,
      hold,
      unknown,
      winRate,
      message:
        total === 0
          ? `${code}の検証データはまだありません`
          : `${code}の現在勝率は${winRate}%です`,
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