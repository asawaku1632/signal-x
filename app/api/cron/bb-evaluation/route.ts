import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { getAdminSession } from "@/app/lib/admin";
import { saveCronRunLog } from "@/app/lib/cronRunLog";
import {
  BB_EVALUATION_CONCURRENCY,
  BB_EVALUATION_MAX_EVENTS,
  BB_EVALUATION_REQUEST_TIMEOUT_MS,
  BB_EVALUATION_TIME_BUDGET_MS,
  evaluatePendingBbEvents,
} from "@/app/lib/learning/bbObservation";
import {
  releaseBbEvaluationLock,
  tryAcquireBbEvaluationLock,
} from "@/app/lib/learning/bbObservationLock";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const ROUTE = "/api/cron/bb-evaluation";

async function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  if (secret && authorization === `Bearer ${secret}`) return true;
  return (await getAdminSession()).isAdmin;
}

export async function GET(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const runId = randomUUID();
  const startedAt = Date.now();
  let lockAcquired = false;
  try {
    const lock = await tryAcquireBbEvaluationLock(runId);
    if (!lock) {
      await saveCronRunLog({
        route: ROUTE,
        status: "SKIPPED",
        message: "BB evaluation is already running",
        details: { runId, reason: "ALREADY_RUNNING", durationMs: Date.now() - startedAt },
      });
      return NextResponse.json({ success: true, skipped: true, reason: "ALREADY_RUNNING" });
    }
    lockAcquired = true;
    const evaluation = await evaluatePendingBbEvents({
      limit: BB_EVALUATION_MAX_EVENTS,
      concurrency: BB_EVALUATION_CONCURRENCY,
      requestTimeoutMs: BB_EVALUATION_REQUEST_TIMEOUT_MS,
      timeBudgetMs: BB_EVALUATION_TIME_BUDGET_MS,
    });
    await saveCronRunLog({
      route: ROUTE,
      status: "COMPLETED",
      message: "BB evaluation completed within its bounded work budget",
      details: { runId, ...evaluation },
    });
    return NextResponse.json({ success: true, ...evaluation });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await saveCronRunLog({
      route: ROUTE,
      status: "ERROR",
      message: "BB evaluation failed",
      details: { runId, durationMs: Date.now() - startedAt, error: message },
    });
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  } finally {
    if (lockAcquired) {
      await releaseBbEvaluationLock(runId).catch((error) => {
        console.error("Failed to release BB evaluation lock:", error);
      });
    }
  }
}
