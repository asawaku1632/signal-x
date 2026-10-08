import { NextResponse } from "next/server";

import {
  isCronAuthorized,
  MAX_DAILY_CHECK_BATCHES,
  MAX_DAILY_CHECK_BATCH_SIZE,
  runDailyCheck,
} from "@/app/lib/learning/checkDailyRunner";
import { saveCronRunLog } from "@/app/lib/cronRunLog";

// Extra daily passes use the same advisory lock, batch size and idempotent
// UNKNOWN-only updates as the original check-daily runner. No re-judging of
// completed WIN / LOSE / HOLD records or use of unsaved market prices.
export async function runDailyCheckRecovery(request: Request, route: string) {
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
      message: "Daily result recovery pass started",
    });

    const report = await runDailyCheck({
      batchSize: MAX_DAILY_CHECK_BATCH_SIZE,
      maxBatches: MAX_DAILY_CHECK_BATCHES,
    });
    const incomplete = report.stopReason === "incomplete_price_coverage";
    const needsAnotherPass =
      report.stopReason === "max_batches" ||
      report.stopReason === "time_budget";

    await saveCronRunLog({
      route,
      status: incomplete
        ? "ERROR"
        : report.running
          ? "SKIPPED"
          : "COMPLETED",
      message: incomplete
        ? "Daily result recovery stopped: missing next-day price coverage"
        : report.running
          ? "Daily result recovery skipped: another check is running"
          : needsAnotherPass
            ? "Daily result recovery pass finished; pending work may remain"
            : "Daily result recovery pass finished",
      httpStatus: incomplete ? 409 : 200,
      details: report,
    });

    return NextResponse.json(report, { status: incomplete ? 409 : 200 });
  } catch (error) {
    console.error("[check-daily-recovery] failed", error);
    await saveCronRunLog({
      route,
      status: "ERROR",
      message: "Daily result recovery failed",
      httpStatus: 500,
      details: {
        error: error instanceof Error ? error.message : String(error),
      },
    });
    return NextResponse.json(
      { success: false, error: "check daily recovery failed" },
      { status: 500 },
    );
  }
}
