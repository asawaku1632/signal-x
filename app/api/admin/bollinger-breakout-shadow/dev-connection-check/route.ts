import { NextResponse } from "next/server";
import { Pool } from "pg";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const DEV_REF = "jdtqwryiyxeuoraecorw";
const headers = { "Cache-Control": "private, no-store" };
const fail = (reason: string, status = 503) =>
  NextResponse.json({ success: false, reason }, { status, headers });

// Production-hosted, owner-only, read-only probe of the *separate development* DB.
// Never falls back to DATABASE_URL and never performs writes or triggers research jobs.
export async function GET() {
  if (!(await getLearningOwnerSession()).isOwner) return fail("OWNER_ONLY", 403);
  if (process.env.VERCEL_ENV !== "production") return fail("PRODUCTION_ONLY", 403);
  if (process.env.BB_DEV_PROBE_ENABLED !== "true") return fail("PROBE_DISABLED", 403);
  if (process.env.BB_DEV_PROBE_PROJECT_REF !== DEV_REF)
    return fail("DEV_PROJECT_REF_MISMATCH", 403);

  const connectionString = process.env.BB_DEV_PROBE_DATABASE_URL;
  let url: URL;
  try { url = new URL(connectionString ?? ""); }
  catch { return fail("INVALID_DATABASE_URL"); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) ||
      decodeURIComponent(url.username) !== "postgres." + DEV_REF ||
      !url.password ||
      !/^[a-z0-9.-]+\.pooler\.supabase\.com$/.test(url.hostname) ||
      !["5432", "6543"].includes(url.port))
    return fail("RESEARCH_DATABASE_IDENTITY_MISMATCH", 403);

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: true },
    max: 1,
    connectionTimeoutMillis: 5000,
    query_timeout: 5000,
    idleTimeoutMillis: 1000,
  });
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN READ ONLY");
    const result = await client.query<{ database_name: string; probe: number }>(
      "SELECT current_database() AS database_name, 1 AS probe"
    );
    await client.query("ROLLBACK");
    if (result.rows[0]?.database_name !== "postgres" || result.rows[0]?.probe !== 1)
      return fail("DATABASE_CHECK_FAILED");
    return NextResponse.json(
      { success: true, result: "DEV_DATABASE_READ_ONLY_CONNECTION_OK" },
      { headers }
    );
  } catch {
    if (client) { try { await client.query("ROLLBACK"); } catch {} }
    return fail("CONNECTION_FAILED_CHECK_CREDENTIALS");
  } finally {
    client?.release();
    await pool.end().catch(() => {});
  }
}
