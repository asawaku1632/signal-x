import { NextResponse } from "next/server";
import pool from "@/app/lib/postgres";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store" };

// Owner-only, production-only, explicitly opt-in, read-only database role check.
// No credentials, connection strings, or database errors are returned.
export async function GET() {
  if (!(await getLearningOwnerSession()).isOwner)
    return NextResponse.json({ success: false, reason: "OWNER_ONLY" }, { status: 403, headers });
  if (process.env.VERCEL_ENV !== "production")
    return NextResponse.json({ success: false, reason: "PRODUCTION_ONLY" }, { status: 403, headers });
  if (process.env.PROD_DB_ROLE_PROBE_ENABLED !== "true")
    return NextResponse.json({ success: false, reason: "PROBE_DISABLED" }, { status: 403, headers });

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN READ ONLY");
    const result = await client.query<{ role: string; table_owner: string }>(
      `SELECT current_user AS role,
              pg_get_userbyid(c.relowner) AS table_owner
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'entry_time_shadow_runs'
        LIMIT 1`
    );
    await client.query("ROLLBACK");
    const row = result.rows[0];
    return NextResponse.json({
      success: Boolean(row),
      roleIsTableOwner: Boolean(row && row.role === row.table_owner),
      roleIsPostgres: row?.role === "postgres",
      tableOwnerIsPostgres: row?.table_owner === "postgres",
    }, { headers });
  } catch {
    if (client) { try { await client.query("ROLLBACK"); } catch {} }
    return NextResponse.json({ success: false, reason: "DB_PROBE_FAILED" }, { status: 503, headers });
  } finally {
    client?.release();
  }
}
