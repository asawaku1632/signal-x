import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { getAdminSession } from "@/app/lib/admin";
import { saveCronRunLog } from "@/app/lib/cronRunLog";
import pool from "@/app/lib/postgres";
import { getLatestScanSnapshot } from "@/app/lib/scanSnapshot";
import { getFallbackTotalStockList } from "@/app/lib/learning/scanEngine";
import { saveBbSignalEvents, type BbObservationStock } from "@/app/lib/learning/bbObservation";
import { getJstDateString, validateBbSnapshot } from "@/app/lib/learning/bbCronValidation";
import {
  releaseBbObservationLock,
  tryAcquireBbObservationLock,
} from "@/app/lib/learning/bbObservationLock";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 180;

const ROUTE = "/api/cron/bb-observation";

async function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  if (secret && authorization === `Bearer ${secret}`) return true;
  return (await getAdminSession()).isAdmin;
}

async function stageLog(
  status: "RECEIVED" | "STARTED" | "PROGRESS" | "COMPLETED" | "SKIPPED" | "ERROR",
  stage: string,
  details: Record<string, unknown>,
) {
  return saveCronRunLog({
    route: ROUTE,
    status,
    message: stage,
    details: { stage, timestamp: new Date().toISOString(), ...details },
  });
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const runId = randomUUID();
  const targetDate = getJstDateString();
  let lockAcquired = false;
  let stage = "BB_RECEIVED";
  const baseDetails = () => ({ runId, targetDate, durationMs: Date.now() - startedAt });

  await stageLog("RECEIVED", stage, baseDetails());
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const lock = await tryAcquireBbObservationLock(targetDate, runId);
    if (!lock) {
      stage = "BB_SKIPPED";
      await stageLog("SKIPPED", stage, {
        ...baseDetails(),
        reason: "ALREADY_RUNNING",
      });
      return NextResponse.json({ success: true, skipped: true, reason: "ALREADY_RUNNING" });
    }
    lockAcquired = true;
    stage = "BB_STARTED";
    await stageLog("STARTED", stage, baseDetails());

    const snapshot = await getLatestScanSnapshot();
    const stocks = (snapshot?.payload.stocks ?? []) as BbObservationStock[];
    const dailyResult = await pool.query(
      "SELECT COUNT(*)::int AS count FROM daily_stock_results WHERE date = $1",
      [targetDate],
    );
    const expectedCount = getFallbackTotalStockList();
    const validation = snapshot
      ? validateBbSnapshot({
          targetDate,
          updatedAt: snapshot.updatedAt,
          itemCount: snapshot.itemCount,
          stockCodes: stocks.map((stock) => String(stock.code ?? "")),
          expectedCount,
          savedDailyCount: Number(dailyResult.rows[0]?.count ?? 0),
        })
      : null;

    if (!snapshot || !validation?.valid) {
      stage = "BB_SKIPPED";
      const reason = validation?.reason ?? "SNAPSHOT_NOT_FOUND";
      await stageLog("SKIPPED", stage, {
        ...baseDetails(),
        reason,
        snapshotUpdatedAt: snapshot?.updatedAt ?? null,
        snapshotItemCount: snapshot?.itemCount ?? 0,
        expectedCount,
        processedCount: stocks.length,
        validation,
      });
      return NextResponse.json({ success: true, skipped: true, reason, validation });
    }

    stage = "BB_SNAPSHOT_VALIDATED";
    await stageLog("PROGRESS", stage, {
      ...baseDetails(),
      snapshotUpdatedAt: snapshot.updatedAt,
      snapshotItemCount: snapshot.itemCount,
      expectedCount,
      processedCount: stocks.length,
      validation,
    });

    stage = "BB_SIGNAL_SAVE_STARTED";
    await stageLog("PROGRESS", stage, {
      ...baseDetails(),
      snapshotItemCount: snapshot.itemCount,
      processedCount: stocks.length,
    });
    const saved = await saveBbSignalEvents(targetDate, stocks);

    stage = "BB_SIGNAL_SAVE_COMPLETED";
    await stageLog("PROGRESS", stage, {
      ...baseDetails(),
      snapshotItemCount: snapshot.itemCount,
      processedCount: saved.processed,
      insertedEventCount: saved.created,
      updatedStateCount: saved.updatedStates,
      batchCount: saved.batchCount,
    });
    stage = "BB_BEFORE_COMPLETED";
    await stageLog("PROGRESS", stage, { ...baseDetails(), ...saved });
    stage = "BB_COMPLETED";
    await stageLog("COMPLETED", stage, { ...baseDetails(), ...saved });

    return NextResponse.json({ success: true, targetDate, snapshotUpdatedAt: snapshot.updatedAt, ...saved });
  } catch (error) {
    stage = "BB_ERROR";
    const message = error instanceof Error ? error.message : String(error);
    await stageLog("ERROR", stage, { ...baseDetails(), error: message });
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  } finally {
    if (lockAcquired) {
      await releaseBbObservationLock(targetDate, runId).catch((error) => {
        console.error("Failed to release BB observation lock:", error);
      });
    }
  }
}
