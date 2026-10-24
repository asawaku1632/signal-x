import { NextResponse } from "next/server";
import { getAdminSession } from "@/app/lib/admin";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Read-only preflight. Does not assert actual manual-save idempotency.
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
    pool = new Pool({ connectionString: cs, max: 1, connectionTimeoutMillis: 4000,
      ssl: { rejectUnauthorized: true, ca: readFileSync(join(process.cwd(),
        "app/api/admin/bollinger-breakout-shadow/dev-connection-check/supabase-root-2021-ca.crt"), "utf8") } });
    const client = await pool.connect();
    try {
      await client.query("BEGIN READ ONLY");
      await client.query("SET LOCAL statement_timeout = 5000");
      const columns = await client.query<{ column_name: string; is_nullable: string }>(
        `SELECT column_name, is_nullable FROM information_schema.columns
         WHERE table_schema='public' AND table_name='market_index_research_runs'
         ORDER BY ordinal_position`);
      const constraints = await client.query<{ constraint_name: string; constraint_type: string; columns: string[] }>(
        `SELECT tc.constraint_name, tc.constraint_type,
           array_agg(kcu.column_name ORDER BY kcu.ordinal_position) AS columns
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON kcu.constraint_schema=tc.constraint_schema AND kcu.constraint_name=tc.constraint_name
         WHERE tc.table_schema='public' AND tc.table_name='market_index_research_runs'
           AND tc.constraint_type IN ('PRIMARY KEY','UNIQUE')
         GROUP BY tc.constraint_name, tc.constraint_type ORDER BY tc.constraint_name`);
      const duplicateRunIds = await client.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM
         (SELECT run_id FROM public.market_index_research_runs GROUP BY run_id HAVING count(*)>1) duplicates`);
      const fixtureRows = await client.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM public.market_index_research_runs
         WHERE provider_id='test-fixture' AND reason='COMMIT_TEST_DELETE_ME'`);
      await client.query("ROLLBACK");
      const runIdUnique = constraints.rows.some(c => { const cols = Array.isArray(c.columns) ? c.columns : typeof c.columns === "string" ? c.columns.replace(/^\\{|\\}$/g, "").split(",") : []; return cols.length === 1 && cols[0] === "run_id"; });
      return NextResponse.json({
        success: true, mode: "READ_ONLY_IDEMPOTENCY_PREFLIGHT",
        columns: columns.rows, uniqueConstraints: constraints.rows,
        runIdUniqueByConstraint: runIdUnique,
        duplicateRunIdGroups: Number(duplicateRunIds.rows[0]?.count ?? 0),
        leftoverCommitTestRows: Number(fixtureRows.rows[0]?.count ?? 0),
        writesPerformed: 0, schedulerEnabled: false,
        actualManualSaveIdempotencyTested: false,
        note: "Schema preflight only. A unique run_id alone does not prove business-key idempotency.",
      }, { headers: { "Cache-Control": "no-store" } });
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
    }
  } catch {
    return NextResponse.json({ success: false, reason: "IDEMPOTENCY_PREFLIGHT_FAILED", writesPerformed: 0 },
      { status: 503, headers: { "Cache-Control": "no-store" } });
  } finally {
    await pool?.end().catch(() => {});
  }
}
