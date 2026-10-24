import { NextResponse } from "next/server";
import { getAdminSession } from "@/app/lib/admin";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Read-only concurrency/retry readiness check against the isolated development DB.
// This does not prove concurrent inserts are safe; a separate controlled write test is required.
export async function GET() {
  const { isAdmin } = await getAdminSession();
  if (!isAdmin || process.env.VERCEL_ENV !== "preview")
    return NextResponse.json({ success: false, reason: "PREVIEW_ADMIN_ONLY" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  if (process.env.MARKET_INDEX_RESEARCH_DEV_READ_ENABLED !== "true")
    return NextResponse.json({ success: false, reason: "DEV_DB_DISABLED" }, { status: 503 });
  const connectionString = process.env.MARKET_INDEX_RESEARCH_DEV_DATABASE_URL;
  if (!connectionString)
    return NextResponse.json({ success: false, reason: "DEV_DB_URL_MISSING" }, { status: 503 });
  let pool: import("pg").Pool | undefined;
  try {
    const url = new URL(connectionString);
    if (!["postgres:", "postgresql:"].includes(url.protocol) ||
        url.hostname !== "aws-0-ap-northeast-1.pooler.supabase.com" ||
        decodeURIComponent(url.username) !== "postgres.jdtqwryiyxeuoraecorw" ||
        url.port !== "5432" || url.pathname !== "/postgres" || !url.password)
      return NextResponse.json({ success: false, reason: "DEV_DB_IDENTITY_MISMATCH" }, { status: 403 });
    const { Pool } = await import("pg");
    pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 4000,
      ssl: { rejectUnauthorized: true, ca: readFileSync(join(process.cwd(),
        "app/api/admin/bollinger-breakout-shadow/dev-connection-check/supabase-root-2021-ca.crt"), "utf8") } });
    const client = await pool.connect();
    try {
      await client.query("BEGIN READ ONLY");
      await client.query("SET LOCAL statement_timeout = 5000");
      const result = await client.query<{ index_key: string; count: string }>(
        `SELECT index_key, count(*)::text AS count
         FROM public.market_index_research_runs
         WHERE reason = 'PROVIDER_APPROVAL_REQUIRED'
           AND checked_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Tokyo') AT TIME ZONE 'Asia/Tokyo'
           AND checked_at < (date_trunc('day', now() AT TIME ZONE 'Asia/Tokyo') + interval '1 day') AT TIME ZONE 'Asia/Tokyo'
           AND index_key IN ('nikkei','topix')
         GROUP BY index_key`
      );
      await client.query("ROLLBACK");
      const counts = { nikkei: 0, topix: 0 };
      for (const row of result.rows) {
        if (row.index_key === "nikkei" || row.index_key === "topix")
          counts[row.index_key] = Number(row.count);
      }
      return NextResponse.json({
        success: true, mode: "READ_ONLY_SAFETY_AUDIT", jstTodayRecordCounts: counts,
        duplicatesObservedToday: counts.nikkei > 1 || counts.topix > 1,
        concurrencyWriteTested: false, retryWriteTested: false,
        databaseReadSucceeded: true, writesPerformed: 0, schedulerEnabled: false,
        nextStep: "Controlled concurrent-write and retry tests remain required",
      }, { headers: { "Cache-Control": "no-store" } });
    } catch {
      await client.query("ROLLBACK").catch(() => {});
      throw new Error("DEV_DB_READ_FAILED");
    } finally {
      client.release();
    }
  } catch {
    return NextResponse.json({ success: false, reason: "DEV_DB_READ_FAILED", writesPerformed: 0 }, { status: 503, headers: { "Cache-Control": "no-store" } });
  } finally {
    await pool?.end().catch(() => {});
  }
}
