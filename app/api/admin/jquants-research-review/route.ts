import { NextResponse } from "next/server";
import { getAdminSession } from "@/app/lib/admin";
import { isAuthorizedResearchOwner, RESEARCH_PRIVATE_HEADERS } from "@/app/lib/research/ownerPreviewPolicy.mjs";
import { reviewLiveDailyReference } from "@/app/lib/research/jQuantsLiveReferenceReview.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 15;

// Fixed historical research sample only. No client-provided arbitrary queries.
export async function POST() {
  const { isAdmin } = await getAdminSession();
  if (!isAuthorizedResearchOwner(isAdmin))
    return NextResponse.json({ success: false, status: "FORBIDDEN" }, { status: 403, headers: RESEARCH_PRIVATE_HEADERS });
  if (process.env.VERCEL_ENV !== "preview" || process.env.JQUANTS_RESEARCH_PROBE_ENABLED !== "true")
    return NextResponse.json({ success: false, status: "RESEARCH_REVIEW_DISABLED" }, { status: 403, headers: RESEARCH_PRIVATE_HEADERS });
  // This is a fixed illustrative reference, NOT a SIGNALX saved signal price.
  // It cannot be used to verify any actual monitoring event or compute returns.
  const result = await reviewLiveDailyReference({
    apiKey: process.env.JQUANTS_API_KEY,
    code: "3996", tradeDate: "2026-07-01", signalReference: 250,
  });
  return NextResponse.json({
    success: result.status === "REVIEW_REQUIRED",
    mode: "OWNER_PREVIEW_ILLUSTRATIVE_REFERENCE_REVIEW",
    sampleIsSynthetic: true, ...result,
  }, { headers: RESEARCH_PRIVATE_HEADERS });
}
