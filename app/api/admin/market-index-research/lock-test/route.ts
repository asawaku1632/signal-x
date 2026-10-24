import { NextResponse } from "next/server";
import { getAdminSession } from "@/app/lib/admin";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Tests contention and retry of the transaction lock without inserting any rows.
// Uses a dedicated test lock namespace, not the live manual-save lock.
export async function GET() {
  const { isAdmin } = await getAdminSession();
  if (!isAdmin || process.env.VERCEL_ENV !== "preview")
    return NextResponse.json({ success: false, reason: "PREVIEW_ADMIN_ONLY" }, { status: 403 });
  if (process.env.MARKET_INDEX_RESEARCH_DEV_READ_ENABLED !== "true")
    return NextResponse.json({ success: false, reason: "DEV_DB_DISABLED" }, { status: 503 });
  const connectionString = process.env.MARKET_INDEX_RESEARCH_DEV_DATABASE_URL;
  if (!connectionString) return NextResponse.json({ success: false, reason: "DEV_DB_URL_MISSING" }, { status: 503 });
  let pool: import("pg").Pool | undefined;
  try {
    const u = new URL(connectionString);
    if (!["postgres:", "postgresql:"].includes(u.protocol) ||
      u.hostname !== "aws-0-ap-northeast-1.pooler.supabase.com" ||
      decodeURIComponent(u.username) !== "postgres.jdtqwryiyxeuoraecorw" ||
      u.port !== "5432" || u.pathname !== "/postgres" || !u.password)
      return NextResponse.json({ success: false, reason: "DEV_DB_IDENTITY_MISMATCH" }, { status: 403 });
    const { Pool } = await import("pg");
    pool = new Pool({ connectionString, max: 2, connectionTimeoutMillis: 4000,
      ssl: { rejectUnauthorized: true, ca: readFileSync(join(process.cwd(),
        "app/api/admin/bollinger-breakout-shadow/dev-connection-check/supabase-root-2021-ca.crt"), "utf8") } });
    const first = await pool.connect();
    let second: import("pg").PoolClient | undefined;
    let firstOpen = false;
    let secondOpen = false;
    try {
      second = await pool.connect();
      await first.query("BEGIN READ ONLY"); firstOpen = true;
      await second.query("BEGIN READ ONLY"); secondOpen = true;
      await first.query("SET LOCAL statement_timeout = 5000");
      await second.query("SET LOCAL statement_timeout = 5000");
      const lockKey = "market-index-preview-lock-self-test";
      const acquire = async (client: import("pg").PoolClient) => {
        const result = await client.query<{ acquired: boolean }>(
          "SELECT pg_try_advisory_xact_lock(hashtext($1)) AS acquired", [lockKey]);
        return result.rows[0]?.acquired === true;
      };
      const firstAcquired = await acquire(first);
      const concurrentRejected = !(await acquire(second));
      await first.query("ROLLBACK"); firstOpen = false;
      const retryAcquired = await acquire(second);
      await second.query("ROLLBACK"); secondOpen = false;
      const success = firstAcquired && concurrentRejected && retryAcquired;
      return NextResponse.json({
        success, mode: "LOCK_CONTENTION_ROLLBACK_TEST",
        firstAcquired, concurrentRejected, retryAcquired,
        transactionsRolledBack: true, writesPerformed: 0,
        concurrentInsertTested: false, retryInsertTested: false,
        schedulerEnabled: false,
      }, { status: success ? 200 : 503, headers: { "Cache-Control": "no-store" } });
    } finally {
      if (firstOpen) await first.query("ROLLBACK").catch(() => {});
      if (secondOpen && second) await second.query("ROLLBACK").catch(() => {});
      second?.release();
      first.release();
    }
  } catch {
    return NextResponse.json({ success: false, reason: "DEV_DB_LOCK_TEST_FAILED", writesPerformed: 0 },
      { status: 503, headers: { "Cache-Control": "no-store" } });
  } finally {
    await pool?.end().catch(() => {});
  }
}
