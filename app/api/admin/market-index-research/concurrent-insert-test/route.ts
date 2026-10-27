import { NextResponse } from "next/server";
import { getAdminSession } from "@/app/lib/admin";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Two simultaneous transactions use the production manual-save lock key,
// but synthetic inserts are ALWAYS rolled back. No persistent test rows.
export async function GET() {
  const { isAdmin } = await getAdminSession();
  if (!isAdmin || process.env.VERCEL_ENV !== "preview")
    return NextResponse.json({ success: false, reason: "PREVIEW_ADMIN_ONLY" }, { status: 403 });
  if (process.env.MARKET_INDEX_RESEARCH_DEV_READ_ENABLED !== "true")
    return NextResponse.json({ success: false, reason: "DEV_DB_DISABLED" }, { status: 503 });
  const cs = process.env.MARKET_INDEX_RESEARCH_DEV_DATABASE_URL;
  if (!cs) return NextResponse.json({ success: false, reason: "DEV_DB_URL_MISSING" }, { status: 503 });
  let pool: import("pg").Pool | undefined;
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
    const runId = "rollback-concurrent-" + crypto.randomUUID();
    const key = "manual-unavailable-nikkei";
    try {
      b = await pool.connect();
      await a.query("BEGIN"); aOpen = true;
      await b.query("BEGIN"); bOpen = true;
      await a.query("SET LOCAL statement_timeout = 5000");
      await b.query("SET LOCAL statement_timeout = 5000");
      await a.query("SELECT pg_advisory_xact_lock(hashtext($1))", [key]);
      const inserted = await a.query(
        `INSERT INTO public.market_index_research_runs
          (run_id, checked_at, index_key, provider_id, provider_rights_verified, status, reason)
          VALUES ($1, now(), 'nikkei', 'test-fixture', false, 'unavailable', 'ROLLBACK_ONLY')`,
        [runId]);
      const seenWithinTransaction = await a.query<{ present: boolean }>(
        "SELECT EXISTS(SELECT 1 FROM public.market_index_research_runs WHERE run_id=$1) AS present", [runId]);
      const concurrentBlocked = !(await b.query<{ acquired: boolean }>(
        "SELECT pg_try_advisory_xact_lock(hashtext($1)) AS acquired", [key])).rows[0]?.acquired;
      await a.query("ROLLBACK"); aOpen = false;
      const retryAcquired = (await b.query<{ acquired: boolean }>(
        "SELECT pg_try_advisory_xact_lock(hashtext($1)) AS acquired", [key])).rows[0]?.acquired === true;
      const absentAfterRollback = !(await b.query<{ present: boolean }>(
        "SELECT EXISTS(SELECT 1 FROM public.market_index_research_runs WHERE run_id=$1) AS present", [runId])).rows[0]?.present;
      await b.query("ROLLBACK"); bOpen = false;
      const success = inserted.rowCount === 1 && seenWithinTransaction.rows[0]?.present === true &&
        concurrentBlocked && retryAcquired && absentAfterRollback;
      return NextResponse.json({
        success, mode: "CONCURRENT_INSERT_ROLLBACK_TEST",
        insertedInsideTransaction: inserted.rowCount === 1,
        seenWithinTransaction: seenWithinTransaction.rows[0]?.present === true,
        concurrentBlocked, retryAcquired, absentAfterRollback,
        writesPersisted: 0, schedulerEnabled: false,
        realConcurrentCommitTested: false, retryAfterCommitTested: false,
      }, { status: success ? 200 : 503, headers: { "Cache-Control": "no-store" } });
    } finally {
      if (aOpen) await a.query("ROLLBACK").catch(() => {});
      if (bOpen && b) await b.query("ROLLBACK").catch(() => {});
      b?.release(); a.release();
    }
  } catch {
    return NextResponse.json({ success: false, reason: "CONCURRENT_INSERT_TEST_FAILED", writesPersisted: 0 },
      { status: 503, headers: { "Cache-Control": "no-store" } });
  } finally {
    await pool?.end().catch(() => {});
  }
}
