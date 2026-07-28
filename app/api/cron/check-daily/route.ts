import { NextResponse } from "next/server";

import {
  isCronAuthorized,
  MAX_DAILY_CHECK_BATCHES,
  MAX_DAILY_CHECK_BATCH_SIZE,
  runDailyCheck,
} from "@/app/lib/learning/checkDailyRunner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { success: false, error: "CRON_SECRET is not configured" },
      { status: 503 },
    );
  }

  if (!isCronAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const report = await runDailyCheck({
      batchSize: MAX_DAILY_CHECK_BATCH_SIZE,
      maxBatches: MAX_DAILY_CHECK_BATCHES,
    });

    return NextResponse.json(report);
  } catch (error) {
    console.error("[check-daily] cron run failed", error);
    return NextResponse.json(
      {
        success: false,
        error: "check daily cron failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
