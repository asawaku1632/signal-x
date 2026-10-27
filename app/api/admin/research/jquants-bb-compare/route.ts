import { NextResponse } from "next/server";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import { fetchBbResearchJquantsBars } from "@/app/lib/research/dailyForwardBbJquantsResearchFetcher.mjs";
import { summarizeBbJquantsComparisons } from "@/app/lib/research/dailyForwardBbJquantsBatchAudit.mjs";
import { observations } from "@/app/lib/research/bbJquantsPinnedObservations.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store" };
const fail = (reason: string, status = 403) =>
  NextResponse.json({ success: false, reason }, { status, headers });

/** Explicit, owner-only, same-origin, Preview-only comparison. No DB or writes. */
export async function POST(request: Request) {
  if (!(await getLearningOwnerSession()).isOwner) return fail("OWNER_ONLY");
  if (process.env.VERCEL_ENV !== "preview") return fail("PREVIEW_ONLY");
  if (process.env.VERCEL_GIT_COMMIT_REF !== "research/morning-quote-metadata-diagnostics-20261026")
    return fail("RESEARCH_BRANCH_ONLY");
  if (process.env.JQUANTS_RESEARCH_PROBE_ENABLED !== "true") return fail("PROBE_DISABLED");
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json")
    return fail("JSON_REQUIRED", 415);
  let sameOrigin = false;
  try {
    const origin = new URL(request.headers.get("origin") ?? "");
    sameOrigin = origin.protocol === "https:" && origin.host === request.headers.get("host");
  } catch { /* fail closed */ }
  if (!sameOrigin) return fail("SAME_ORIGIN_REQUIRED");
  let body: unknown;
  try { body = await request.json(); } catch { return fail("INVALID_BODY", 400); }
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      (body as { confirm?: unknown }).confirm !== "JQUANTS_BB_COMPARE_READ_ONLY")
    return fail("EXPLICIT_CONFIRMATION_REQUIRED", 400);

  const fetched = await fetchBbResearchJquantsBars({
    enabled: true, apiKey: process.env.JQUANTS_API_KEY,
  });
  if (fetched.status !== "RESEARCH_ONLY_BARS_FETCHED")
    return fail(fetched.reason ?? "FETCH_FAILED", 503);
  const audit = summarizeBbJquantsComparisons(observations, fetched.barsByCode);
  return NextResponse.json({
    success: true, kind: "BB_JQUANTS_CLOSE_RESEARCH_COMPARISON",
    snapshot: "PINNED_DEV_SNAPSHOT_2026_10_27",
    total: audit.total, matched: audit.matched, differed: audit.differed,
    blocked: audit.blocked, reasons: audit.reasons,
    details: audit.details.map(({code,observationDate,status,reason}) =>
      ({code,observationDate,status,reason})),
    priceBasisVerified: false, licenseReview: "NOT_VERIFIED",
    pricesExposed: false, saved: false, autoApply: false,
    productionWrites: false, productionApproval: false,
    note: "Research-only unadjusted exit close check; not a trade performance verification.",
  }, { headers });
}
