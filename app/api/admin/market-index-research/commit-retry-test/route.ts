import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/app/lib/admin";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Preview-only, explicit POST. Commits one uniquely marked synthetic row, then
// removes it in finally. A failed cleanup is reported, never described as safe.
export async function POST(req: NextRequest) {
  const { isAdmin } = await getAdminSession();
  if (!isAdmin || process.env.VERCEL_ENV !== "preview")
    return NextResponse.json({ success: false, reason: "PREVIEW_ADMIN_ONLY" }, { status: 403 });
  if (req.headers.get("origin") !== new URL(req.url).origin)
    return NextResponse.json({ success: false, reason: "ORIGIN_MISMATCH" }, { status: 403 });
  if (process.env.MARKET_INDEX_RESEARCH_DEV_READ_ENABLED !== "true")
    return NextResponse.json({ success: false, reason: "DEV_DB_DISABLED" }, { status: 503 });
  const cs = process.env.MARKET_INDEX_RESEARCH_DEV_DATABASE_URL;
  if (!cs) return NextResponse.json({ success: false, reason: "DEV_DB_URL_MISSING" }, { status: 503 });
  let pool: import("pg").Pool | undefined;
  const runId = "commit-test-" + crypto.randomUUID();
  let committed = false;
  let cleanupVerified = false;
  let firstLockAcquired = false;
  let concurrentBlocked = false;
  let retryAcquired = false;
  let retrySawCommittedRow = false;
  let duplicateSkipped = false;
  let failure: string | null = null;
  try {
    const u = new URL(cs);
    if (!["postgres:", "postgresql:"].includes(u.protocol) ||
      u.hostname !== "aws-0-ap-northeast-1.pooler.supabase.com" ||
      decodeURIComponent(u.username) !== "postgres.jdtqwryiyxeuoraecorw" ||
      u.port !== "5432" || u.pathname !== "/postgres" || !u.password)
      return NextResponse.json({ success: false, reason: "DEV_DB_IDENTITY_MISMATCH" }, { status: 403 });
    const { Pool } = await import("pg");
    pool = new Pool({ connectionString: cs, max: 2, connectionTimeoutMillis: 4000,
      ssl: { rejectUnauthorized: true, ca: readFileSync(join(process.cwd(),
        "app/api/admin/bollinger-breakout-shadow/dev-connection-check/supabase-root-2021-ca.crt"), "utf8") } });
    const a = await pool.connect();
    let b: import("pg").PoolClient | undefined;
    let aOpen = false, bOpen = false;
    try {
      b = await pool.connect();
      await a.query("BEGIN"); aOpen = true;
      await b.query("BEGIN"); bOpen = true;
      await a.query("SET LOCAL statement_timeout = 5000");
      await b.query("SET LOCAL statement_timeout = 5000");
      const key = "market-index-preview-commit-test-" + runId;
      firstLockAcquired = (await a.query<{ acquired: boolean }>(
        "SELECT pg_try_advisory_xact_lock(hashtext($1)) AS acquired", [key])).rows[0]?.acquired === true;
      if (!firstLockAcquired) throw new Error("FIRST_LOCK_FAILED");
      await a.query(`INSERT INTO public.market_index_research_runs
        (run_id, checked_at, index_key, provider_id, provider_rights_verified, status, reason)
        VALUES ($1, now(), 'nikkei', 'test-fixture', false, 'unavailable', 'COMMIT_TEST_DELETE_ME')`, [runId]);
      concurrentBlocked = (await b.query<{ acquired: boolean }>(
        "SELECT pg_try_advisory_xact_lock(hashtext($1)) AS acquired", [key])).rows[0]?.acquired === false;
      if (!concurrentBlocked) throw new Error("CONTENTION_FAILED");
      await a.query("COMMIT"); aOpen = false; committed = true;
      retryAcquired = (await b.query<{ acquired: boolean }>(
        "SELECT pg_try_advisory_xact_lock(hashtext($1)) AS acquired", [key])).rows[0]?.acquired === true;
      const existing = await b.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM public.market_index_research_runs WHERE run_id=$1", [runId]);
      retrySawCommittedRow = existing.rows[0]?.n === "1";
      // The retry must skip insertion when this exact synthetic run already exists.
      duplicateSkipped = retryAcquired && retrySawCommittedRow;
      await b.query("ROLLBACK"); bOpen = false;
    } finally {
      if (aOpen) await a.query("ROLLBACK").catch(() => {});
      if (bOpen && b) await b.query("ROLLBACK").catch(() => {});
      b?.release(); a.release();
    }
  } catch (err) {
    failure = err instanceof Error ? err.message : "TEST_FAILED";
  } finally {
    if (pool) {
      try {
        // Cleanup is attempted even when the test fails after COMMIT.
        const result = await pool.query(
          "DELETE FROM public.market_index_research_runs WHERE run_id=$1 AND provider_id='test-fixture' AND reason='COMMIT_TEST_DELETE_ME'", [runId]);
        const check = await pool.query<{ n: string }>(
          "SELECT count(*)::text AS n FROM public.market_index_research_runs WHERE run_id=$1", [runId]);
        cleanupVerified = check.rows[0]?.n === "0" && (!committed || result.rowCount === 1);
      } catch {
        cleanupVerified = false;
        failure = failure || "CLEANUP_FAILED";
      }
      await pool.end().catch(() => {});
    }
  }
  const success = !failure && committed && firstLockAcquired && concurrentBlocked &&
    retryAcquired && retrySawCommittedRow && duplicateSkipped && cleanupVerified;
  return NextResponse.json({
    success, mode: "PREVIEW_COMMIT_RETRY_CLEANUP_TEST",
    firstLockAcquired, concurrentBlocked, committed, retryAcquired,
    retrySawCommittedRow, duplicateSkipped, cleanupVerified,
    testRunId: success ? undefined : runId,
    schedulerEnabled: false,
    productionTested: false,
    actualManualSaveIdempotencyTested: false,
    ...(failure ? { reason: failure } : {}),
  }, { status: success ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
