import { NextResponse } from "next/server";
import pool from "@/app/lib/postgres";
import { saveCronRunLog } from "@/app/lib/cronRunLog";
import { getJstDateString, isJstBusinessDay } from "@/app/lib/learning/learningSaveStatus";
import { getFallbackTotalStockList } from "@/app/lib/learning/scanEngine";
import { validateDailyScanCoverage } from "@/app/lib/learning/dailyScanGuard";
import { updatePatternForwardOutcomes, refreshPatternForwardStats } from "@/app/lib/learning/patternForwardLearning";
import { saveTrendPullbackReversalObservations, updateTrendPullbackReversalOutcomes } from "@/app/lib/learning/trendPullbackReversal";
import { saveAiReversalObservations, updateAiReversalOutcomes } from "@/app/lib/learning/aiReversal";
import { saveHighAiPullbackObservations, updateHighAiPullbackOutcomes } from "@/app/lib/learning/highAiPullback";
import {
  saveMomentumMemoryObservations,
  updateMomentumMemoryOutcomes,
  updateMomentumMemoryBenchmarks,
  updateMomentumMemoryNotificationOutcomes,
  refreshMomentumMemoryForwardStats,
  refreshMomentumMemoryNotificationValidation,
} from "@/app/lib/learning/momentumMemory";
import { saveExplosiveCandidateDiscoveryPrices } from "@/app/lib/learning/explosiveDiscoveryPrices";
import { notifyMomentumMemoryCandidates } from "@/app/lib/learning/momentumMemoryNotification";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 180;

const ROUTE = "/api/cron/save-post";
const PHASES = ["pattern", "reversal", "momentum", "finalize"] as const;
type Phase = (typeof PHASES)[number];

type Task = { label: string; run: () => Promise<unknown> };

function tasksFor(phase: Phase, date: string): Task[] {
  switch (phase) {
    case "pattern":
      return [
        // Settle existing forward outcomes before potentially expensive pattern scans.
        { label: "trend-reversal-outcomes", run: () => updateTrendPullbackReversalOutcomes(date) },
        { label: "trend-reversal-observations", run: () => saveTrendPullbackReversalObservations(date) },
        { label: "pattern-outcomes", run: () => updatePatternForwardOutcomes(date) },
        { label: "pattern-stats", run: () => refreshPatternForwardStats() },
      ];
    case "reversal":
      return [
        { label: "ai-reversal-observations", run: () => saveAiReversalObservations(date) },
        { label: "ai-reversal-outcomes", run: () => updateAiReversalOutcomes(date) },
        { label: "high-ai-pullback-observations", run: () => saveHighAiPullbackObservations(date) },
        { label: "high-ai-pullback-outcomes", run: () => updateHighAiPullbackOutcomes(date) },
      ];
    case "momentum":
      return [
        { label: "momentum-observations", run: () => saveMomentumMemoryObservations(date) },
        { label: "momentum-outcomes", run: () => updateMomentumMemoryOutcomes(date) },
        { label: "momentum-benchmarks", run: () => updateMomentumMemoryBenchmarks(date) },
      ];
    case "finalize":
      return [
        { label: "momentum-notification-outcomes", run: () => updateMomentumMemoryNotificationOutcomes(date) },
        { label: "momentum-forward-stats", run: () => refreshMomentumMemoryForwardStats() },
        { label: "momentum-notification-validation", run: () => refreshMomentumMemoryNotificationValidation() },
        { label: "explosive-candidate-prices", run: () => saveExplosiveCandidateDiscoveryPrices(date) },
        { label: "momentum-admin-notification", run: () => notifyMomentumMemoryCandidates(date) },
      ];
  }
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, reason: "Unauthorized" }, { status: 401 });
  }

  const phaseParam = new URL(req.url).searchParams.get("phase");
  if (!PHASES.some((item) => item === phaseParam)) {
    return NextResponse.json({ success: false, reason: "Invalid phase" }, { status: 400 });
  }
  const phase = phaseParam as Phase;
  const date = getJstDateString();
  if (!isJstBusinessDay()) {
    return NextResponse.json({ success: true, skipped: true, reason: "NON_BUSINESS_DAY", date, phase });
  }

  const { rows } = await pool.query(
    "SELECT COUNT(*)::int AS count FROM daily_stock_results WHERE date = $1",
    [date],
  );
  const snapshotCount = Number(rows[0]?.count ?? 0);
  const coverage = validateDailyScanCoverage(snapshotCount, getFallbackTotalStockList());
  if (!coverage.valid) {
    return NextResponse.json(
      { success: false, reason: "DAILY_SNAPSHOT_NOT_READY", phase, date, snapshotCount },
      { status: 503 },
    );
  }

  // One phase per job, protected against concurrent invocations and repeat notifications.
  const lockKey = `signalx-save-post:${date}:${phase}`;
  const runId = crypto.randomUUID();
  const lock = await pool.query(
    `INSERT INTO cron_execution_locks (lock_key, owner_id, acquired_at, expires_at)
     VALUES ($1, $2, NOW(), NOW() + INTERVAL '4 minutes')
     ON CONFLICT (lock_key) DO UPDATE SET
       owner_id = EXCLUDED.owner_id,
       acquired_at = EXCLUDED.acquired_at,
       expires_at = EXCLUDED.expires_at
     WHERE cron_execution_locks.expires_at <= NOW()
     RETURNING lock_key`,
    [lockKey, runId],
  );
  if (lock.rowCount === 0) {
    return NextResponse.json({ success: true, skipped: true, reason: "ALREADY_RUNNING", date, phase });
  }

  const startedAt = Date.now();
  const details = { runId, targetDate: date, phase, snapshotCount };
  try {
    const finished = await pool.query(
      `SELECT 1 FROM cron_run_logs
       WHERE route = $1 AND status = 'COMPLETED'
         AND details->>'targetDate' = $2 AND details->>'phase' = $3
       LIMIT 1`,
      [ROUTE, date, phase],
    );
    if ((finished.rowCount ?? 0) > 0) {
      return NextResponse.json({ success: true, skipped: true, reason: "ALREADY_COMPLETED", date, phase });
    }

    await saveCronRunLog({
      route: ROUTE, status: "STARTED", message: "Post-save research phase started", details,
    });
    for (const task of tasksFor(phase, date)) {
      const stepStartedAt = Date.now();
      await saveCronRunLog({
        route: ROUTE, status: "PROGRESS", message: "Post-save research task started",
        details: { ...details, step: task.label, stepState: "STARTED" },
      });
      try {
        await task.run();
      } catch (taskError) {
        const taskMessage = taskError instanceof Error ? taskError.message : String(taskError);
        await saveCronRunLog({
          route: ROUTE, status: "ERROR", message: "Post-save research task failed",
          details: { ...details, step: task.label, stepState: "FAILED",
            stepDurationMs: Date.now() - stepStartedAt, failureReason: taskMessage.slice(0, 500) },
        });
        throw taskError;
      }
      await saveCronRunLog({
        route: ROUTE, status: "PROGRESS", message: "Post-save research task completed",
        details: { ...details, step: task.label, stepDurationMs: Date.now() - stepStartedAt },
      });
    }
    const durationMs = Date.now() - startedAt;
    await saveCronRunLog({
      route: ROUTE, status: "COMPLETED", message: "Post-save research phase completed",
      details: { ...details, durationMs },
    });
    return NextResponse.json({ success: true, date, phase, durationMs });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await saveCronRunLog({
      route: ROUTE, status: "ERROR", message: "Post-save research phase failed",
      details: { ...details, durationMs: Date.now() - startedAt, failureReason: message.slice(0, 500) },
    });
    return NextResponse.json({ success: false, date, phase, error: message.slice(0, 500) }, { status: 500 });
  } finally {
    await pool.query("DELETE FROM cron_execution_locks WHERE lock_key = $1 AND owner_id = $2", [lockKey, runId]);
  }
}
