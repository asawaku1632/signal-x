import { NextResponse } from "next/server";
import { Pool } from "pg";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import { getBbAuditBatch, summarizeBbAudit } from "@/app/lib/research/bbBatchAudit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
const date = "2026-08-10";
const headers = { "Cache-Control": "private, no-store" };
const fail = (reason: string, status = 403) => NextResponse.json({ success: false, reason }, { status, headers });

export async function POST(request: Request) {
  if (!(await getLearningOwnerSession()).isOwner) return fail("OWNER_ONLY");
  if (process.env.VERCEL_ENV !== "preview" ||
      process.env.VERCEL_GIT_COMMIT_REF !== "research/morning-quote-metadata-diagnostics-20261026" ||
      process.env.JQUANTS_RESEARCH_PROBE_ENABLED !== "true") return fail("RESEARCH_PREVIEW_ONLY");
  let dbUrl: URL;
  try { dbUrl = new URL(process.env.MARKET_INDEX_RESEARCH_DEV_DATABASE_URL ?? ""); }
  catch { return fail("DEV_DB_NOT_CONFIGURED", 503); }
  if (!(dbUrl.hostname === "db.jdtqwryiyxeuoraecorw.supabase.co" ||
        (dbUrl.hostname.endsWith(".pooler.supabase.com") && dbUrl.username.includes("jdtqwryiyxeuoraecorw"))))
    return fail("DEV_DB_NOT_VERIFIED", 503);
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return fail("JSON_REQUIRED", 415);
  try {
    const origin = new URL(request.headers.get("origin") ?? "");
    if (origin.protocol !== "https:" || origin.host !== request.headers.get("host")) return fail("SAME_ORIGIN_REQUIRED");
  } catch { return fail("SAME_ORIGIN_REQUIRED"); }
  let body: unknown;
  try { body = await request.json(); } catch { return fail("INVALID_BODY", 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return fail("INVALID_BODY", 400);
  const input = body as { confirm?: unknown; batch?: unknown };
  if (input.confirm !== "READ_ONLY_BB_25_PRICE_COMPARISON") return fail("EXPLICIT_CONFIRMATION_REQUIRED", 400);
  if (!process.env.JQUANTS_API_KEY) return fail("PROVIDER_KEY_UNAVAILABLE", 503);

  const pool = new Pool({ connectionString: process.env.MARKET_INDEX_RESEARCH_DEV_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1, connectionTimeoutMillis: 8000 });
  let saved: { code: string; entry_price: string; side: string; status: string }[];
  let bounds: ReturnType<typeof getBbAuditBatch>;
  try {
    const count = await pool.query("SELECT COUNT(*)::int AS total FROM public.bb_signal_events WHERE signal_date=$1::date", [date]);
    bounds = getBbAuditBatch(count.rows[0].total, input.batch as number);
    const rows = await pool.query("SELECT code, entry_price::text, side, status FROM public.bb_signal_events WHERE signal_date=$1::date ORDER BY code LIMIT $2 OFFSET $3", [date, bounds.limit, bounds.offset]);
    saved = rows.rows;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "DEV_READ_FAILED";
    return fail(["INVALID_BATCH", "RESEARCH_COHORT_CHANGED"].includes(reason) ? reason : "DEV_READ_FAILED", 409);
  } finally { await pool.end(); }
  if (saved.length !== bounds.expected || new Set(saved.map(x => x.code)).size !== saved.length) return fail("SAVED_SAMPLE_INCOMPLETE", 409);

  const results: { code: string; status: string; side: string; savedPrice: number; referenceClose: number | null; difference: number | null; result: string }[] = [];
  for (const item of saved) {
    const url = new URL("https://api.jquants.com/v2/equities/bars/daily");
    url.searchParams.set("code", item.code);
    url.searchParams.set("from", "20260810");
    url.searchParams.set("to", "20260810");
    let referenceClose: number | null = null;
    let result = "PROVIDER_UNAVAILABLE";
    try {
      const response = await fetch(url, { headers: { "x-api-key": process.env.JQUANTS_API_KEY!, Accept: "application/json" }, redirect: "error", signal: AbortSignal.timeout(4500), cache: "no-store" });
      if (response.ok) {
        const payload = await response.json();
        if (Array.isArray(payload?.data) && !payload.pagination_key) {
          const bars = payload.data.filter((x: Record<string, unknown>) => x.Date === date && (x.Code === item.code || x.Code === item.code + "0"));
          if (bars.length === 1 && bars[0].C != null && Number.isFinite(Number(bars[0].C)) && Number(bars[0].C) > 0) {
            referenceClose = Number(bars[0].C);
            result = "COMPARED_UNVERIFIED_BASIS";
          } else result = "REFERENCE_BAR_MISSING_OR_AMBIGUOUS";
        } else result = "INVALID_PROVIDER_RESPONSE";
      } else result = response.status === 429 ? "RATE_LIMITED" : "PROVIDER_REQUEST_FAILED";
    } catch { result = "PROVIDER_UNAVAILABLE"; }
    const savedPrice = Number(item.entry_price);
    results.push({ code: item.code, status: item.status, side: item.side, savedPrice, referenceClose, difference: referenceClose === null ? null : Number((savedPrice - referenceClose).toFixed(4)), result });
  }
  return NextResponse.json({ success: true, kind: "BB_25_READ_ONLY_RESEARCH", signalDate: date, batch: input.batch, offset: bounds.offset, batchSize: bounds.limit, total: 419, summary: summarizeBbAudit(results), priceBasisVerified: false, licenseVerified: false, saved: false, productionApplied: false, results }, { headers });
}
