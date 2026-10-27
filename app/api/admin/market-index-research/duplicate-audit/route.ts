import { NextResponse } from "next/server";
import { getAdminSession } from "@/app/lib/admin";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const { isAdmin } = await getAdminSession();
  if (!isAdmin || process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ success: false, reason: "PREVIEW_ADMIN_ONLY" }, { status: 403 });
  }
  if (process.env.MARKET_INDEX_RESEARCH_DEV_READ_ENABLED !== "true") {
    return NextResponse.json({ success: false, reason: "DEV_DB_DISABLED" }, { status: 403 });
  }
  const connectionString = process.env.MARKET_INDEX_RESEARCH_DEV_DATABASE_URL;
  if (!connectionString) return NextResponse.json({ success: false, reason: "DEV_DB_URL_MISSING" }, { status: 503 });
  let pool: import("pg").Pool | undefined;
  try {
    const url = new URL(connectionString);
    const ref = "jdtqwryiyxeuoraecorw";
    const direct = url.hostname === `db.${ref}.supabase.co` && url.username === "postgres" && url.port === "5432";
    const pooler = url.hostname === "aws-0-ap-northeast-1.pooler.supabase.com" &&
      decodeURIComponent(url.username) === `postgres.${ref}` && url.port === "5432";
    if (!["postgres:", "postgresql:"].includes(url.protocol) || (!direct && !pooler) ||
        url.pathname !== "/postgres" || !url.password) {
      return NextResponse.json({ success: false, reason: "DEV_DB_IDENTITY_MISMATCH" }, { status: 403 });
    }
    const { Pool } = await import("pg");
    pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 4000,
      ssl: { rejectUnauthorized: true, ca: readFileSync(join(process.cwd(),
        "app/api/admin/bollinger-breakout-shadow/dev-connection-check/supabase-root-2021-ca.crt"), "utf8") } });
    const client = await pool.connect();
    try {
      await client.query("BEGIN READ ONLY");
      await client.query("SET LOCAL statement_timeout = 5000");
      const result = await client.query<{ jst_date: string; index_key: string; saved_count: string; result: string }>(
        `SELECT (checked_at AT TIME ZONE 'Asia/Tokyo')::date::text AS jst_date,
          index_key, COUNT(*)::text AS saved_count,
          CASE WHEN COUNT(*) = 1 THEN 'OK' ELSE 'DUPLICATE' END AS result
         FROM public.market_index_research_runs
         WHERE reason = 'PROVIDER_APPROVAL_REQUIRED'
         GROUP BY 1, 2 ORDER BY 1 DESC, 2`
      );
      await client.query("COMMIT");
      const groups = result.rows.map(row => ({ ...row, saved_count: Number(row.saved_count) }));
      const duplicateGroups = groups.filter(row => row.result === "DUPLICATE").length;
      return NextResponse.json({ success: true, mode: "PREVIEW_DEV_READ_ONLY_AUDIT",
        asOf: new Date().toISOString(), groups, groupCount: groups.length, duplicateGroups,
        decision: groups.length === 0 ? "NO_DATA" : duplicateGroups > 0 ? "DUPLICATE_DETECTED" : "PASS",
        marketDataCaptured: false, scheduledCaptureConfigured: false },
        { headers: { "Cache-Control": "no-store" } });
    } catch {
      await client.query("ROLLBACK").catch(() => {});
      return NextResponse.json({ success: false, reason: "QUERY_FAILED" }, { status: 503 });
    } finally { client.release(); }
  } catch {
    return NextResponse.json({ success: false, reason: "DEV_DB_READ_FAILED" }, { status: 503 });
  } finally { await pool?.end().catch(() => {}); }
}
