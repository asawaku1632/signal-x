import { NextResponse } from "next/server";
import { Pool } from "pg";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
const fail = (reason: string, status = 403) => NextResponse.json({ success: false, reason }, { status, headers });
const allowed = () => process.env.VERCEL_ENV === "preview" &&
  process.env.VERCEL_GIT_COMMIT_REF === "research/morning-quote-metadata-diagnostics-20261026" &&
  process.env.JQUANTS_RESEARCH_PROBE_ENABLED === "true";
function verifiedDb() {
  try {
    const url = new URL(process.env.MARKET_INDEX_RESEARCH_DEV_DATABASE_URL ?? "");
    return url.hostname === "db.jdtqwryiyxeuoraecorw.supabase.co" ||
      (url.hostname.endsWith(".pooler.supabase.com") && url.username.includes("jdtqwryiyxeuoraecorw"));
  } catch { return false; }
}
export async function POST(request: Request) {
  if (!(await getLearningOwnerSession()).isOwner) return fail("OWNER_ONLY");
  if (!allowed()) return fail("RESEARCH_PREVIEW_ONLY");
  if (!verifiedDb()) return fail("DEV_DB_NOT_VERIFIED", 503);
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return fail("JSON_REQUIRED", 415);
  try {
    const origin = new URL(request.headers.get("origin") ?? "");
    if (origin.protocol !== "https:" || origin.host !== request.headers.get("host")) return fail("SAME_ORIGIN_REQUIRED");
  } catch { return fail("SAME_ORIGIN_REQUIRED"); }
  let body: unknown;
  try { body = await request.json(); } catch { return fail("INVALID_JSON", 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return fail("INVALID_BODY", 400);
  const b = body as Record<string, unknown>;
  if (b.confirm !== "SAVE_UNVERIFIED_RESEARCH_INTAKE") return fail("CONFIRMATION_REQUIRED", 400);
  if (typeof b.code !== "string" || !/^[0-9]{4}$/.test(b.code) ||
      typeof b.signalLabel !== "string" || !b.signalLabel.trim() || b.signalLabel.length > 80 ||
      typeof b.provider !== "string" || !b.provider.trim() || b.provider.length > 80 ||
      typeof b.modelVersion !== "string" || !b.modelVersion.trim() || b.modelVersion.length > 80 ||
      typeof b.price !== "number" || !Number.isFinite(b.price) || b.price <= 0 ||
      (b.quoteAt !== null && b.quoteAt !== undefined && (typeof b.quoteAt !== "string" || !Number.isFinite(Date.parse(b.quoteAt)))))
    return fail("INVALID_FIELDS", 400);
  const pool = new Pool({ connectionString: process.env.MARKET_INDEX_RESEARCH_DEV_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1, connectionTimeoutMillis: 8000 });
  try {
    const result = await pool.query(
      "INSERT INTO public.bb_prospective_research_intake (code, signal_label, claimed_price, claimed_provider, claimed_quote_at, model_version) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,received_at,evidence_status",
      [b.code,b.signalLabel.trim(),b.price,b.provider.trim(),b.quoteAt ?? null,b.modelVersion.trim()]);
    return NextResponse.json({ success:true, saved:true, productionApplied:false, evidenceEligible:false, ...result.rows[0] }, { headers });
  } catch { return fail("DEV_WRITE_FAILED", 503); }
  finally { await pool.end(); }
}

export async function GET() {
  if (!(await getLearningOwnerSession()).isOwner) return fail("OWNER_ONLY");
  if (!allowed()) return fail("RESEARCH_PREVIEW_ONLY");
  if (!verifiedDb()) return fail("DEV_DB_NOT_VERIFIED", 503);
  const pool = new Pool({ connectionString: process.env.MARKET_INDEX_RESEARCH_DEV_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1, connectionTimeoutMillis: 8000 });
  try {
    const [summary, rows] = await Promise.all([
      pool.query("SELECT count(*)::int AS total, count(*) FILTER (WHERE production_applied)::int AS production_applied FROM public.bb_prospective_research_intake"),
      pool.query("SELECT id,code,signal_label,claimed_price::text,claimed_provider,claimed_quote_at,model_version,received_at,evidence_status,production_applied FROM public.bb_prospective_research_intake ORDER BY received_at DESC,id DESC LIMIT 20")
    ]);
    return NextResponse.json({ success:true, mode:"UNVERIFIED_RESEARCH_INTAKE", saved:false, productionApplied:false, summary:summary.rows[0], records:rows.rows }, { headers });
  } catch { return fail("DEV_READ_FAILED",503); }
  finally { await pool.end(); }
}
