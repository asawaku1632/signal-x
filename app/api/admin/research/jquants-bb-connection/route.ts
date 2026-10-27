import { NextResponse } from "next/server";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import { fetchBbResearchJquantsBars } from "@/app/lib/research/dailyForwardBbJquantsResearchFetcher.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store" };
const fail = (reason: string, status = 403) =>
  NextResponse.json({ success: false, reason }, { status, headers });

/**
 * Explicit owner-only Preview probe. No database access, saved prices,
 * automated triggers, production modifications or raw price disclosure.
 */
export async function POST(request: Request) {
  if (!(await getLearningOwnerSession()).isOwner) return fail("OWNER_ONLY");
  if (process.env.VERCEL_ENV !== "preview") return fail("PREVIEW_ONLY");
  if (process.env.VERCEL_GIT_COMMIT_REF !==
      "research/morning-quote-metadata-diagnostics-20261026")
    return fail("RESEARCH_BRANCH_ONLY");
  if (process.env.JQUANTS_RESEARCH_PROBE_ENABLED !== "true")
    return fail("PROBE_DISABLED");
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json")
    return fail("JSON_REQUIRED", 415);
  // Browser requests must be same-origin. No cross-site execution.
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host || new URL(origin).protocol !== "https:")
    return fail("SAME_ORIGIN_REQUIRED");
  let body: unknown;
  try { body = await request.json(); } catch { return fail("INVALID_BODY", 400); }
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      (body as { confirm?: unknown }).confirm !== "JQUANTS_RESEARCH_READ_ONLY")
    return fail("EXPLICIT_CONFIRMATION_REQUIRED", 400);
  const result = await fetchBbResearchJquantsBars({
    enabled: true, apiKey: process.env.JQUANTS_API_KEY,
  });
  if (result.status !== "RESEARCH_ONLY_BARS_FETCHED")
    return fail(result.reason ?? "FETCH_FAILED", 503);
  const counts = Object.fromEntries(
    Object.entries(result.barsByCode).map(([code, bars]) => [code, bars.length])
  );
  return NextResponse.json({
    success: true, kind: "JQUANTS_RESEARCH_BOUNDED_CONNECTION_PROBE",
    counts, licenseReview: "NOT_VERIFIED",
    pricesExposed: false, saved: false, productionWrites: false,
    note: "Connectivity and record counts only; no close-price comparison or performance verification.",
  }, { headers });
}
