import { NextRequest, NextResponse } from "next/server";
import { runAutoLearning } from "@/app/lib/learning/autoLearningRunner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEBUG_VERSION = "V22_1_DAILY_LEARNING_CRON_0707";

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;

  const userAgent = request.headers.get("user-agent") ?? "";
  const isVercelCron = userAgent.toLowerCase().includes("vercel-cron");

  const authHeader = request.headers.get("authorization") ?? "";
  const bearerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";

  const querySecret = request.nextUrl.searchParams.get("secret") ?? "";

  if (cronSecret) {
    return bearerToken === cronSecret || querySecret === cronSecret || isVercelCron;
  }

  return process.env.NODE_ENV !== "production";
}

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json(
        {
          success: false,
          debugVersion: DEBUG_VERSION,
          checkedAt: new Date().toISOString(),
          error: "Unauthorized cron request",
        },
        { status: 401 }
      );
    }

    const limit = Number(request.nextUrl.searchParams.get("limit") ?? 300);
    const minSampleCount = Number(
      request.nextUrl.searchParams.get("minSampleCount") ?? 3
    );

    const report = await runAutoLearning({
      mode: "execute",
      judgeLimit: Number.isFinite(limit) ? limit : 300,
      minSampleCount: Number.isFinite(minSampleCount) ? minSampleCount : 3,
    });

    return NextResponse.json({
      success: true,
      debugVersion: DEBUG_VERSION,
      checkedAt: new Date().toISOString(),
      schedule: "Weekdays 15:40 JST / 06:40 UTC",
      autoLearning: report,
      summary: report.summary,
      nextAction:
        "learning quality APIで品質スコア、判定済み件数、AI重みルール数を確認してください。",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        debugVersion: DEBUG_VERSION,
        checkedAt: new Date().toISOString(),
        error:
          error instanceof Error
            ? error.message
            : "daily learning cron failed",
      },
      { status: 500 }
    );
  }
}
