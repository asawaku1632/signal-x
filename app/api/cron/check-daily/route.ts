import { NextResponse } from "next/server";

import {
  isCronAuthorized,
  MAX_DAILY_CHECK_BATCHES,
  MAX_DAILY_CHECK_BATCH_SIZE,
  runDailyCheck,
} from "@/app/lib/learning/checkDailyRunner";
import { saveCronRunLog } from "@/app/lib/cronRunLog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const route = "/api/cron/check-daily";
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
    await saveCronRunLog({
      route,
      status: "STARTED",
      message: "Daily result check started",
    });
    const report = await runDailyCheck({
      batchSize: MAX_DAILY_CHECK_BATCH_SIZE,
      maxBatches: MAX_DAILY_CHECK_BATCHES,
    });

    const incomplete = report.stopReason === "incomplete_price_coverage";
    await saveCronRunLog({
      route,
      status: incomplete ? "ERROR" : "COMPLETED",
      message: incomplete
        ? "Daily result check stopped with missing next-day coverage"
        : "Daily result check completed",
      httpStatus: incomplete ? 409 : 200,
      details: report,
    });

    return NextResponse.json(report, { status: incomplete ? 409 : 200 });
  } catch (error) {
    console.error("[check-daily] cron run failed", error);
    await saveCronRunLog({
      route,
      status: "ERROR",
      message: "Daily result check failed",
      httpStatus: 500,
      details: {
        error: error instanceof Error ? error.message : String(error),
      },
    });
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
