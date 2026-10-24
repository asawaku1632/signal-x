import { NextResponse } from "next/server";
import { getAdminSession } from "@/app/lib/admin";
import { verifyResearchSchedulerToken } from "@/app/lib/researchSchedulerAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Admin-only self-test; never sends the secret to the browser or makes a write.
export async function GET() {
  const { isAdmin } = await getAdminSession();
  if (!isAdmin || process.env.VERCEL_ENV !== "preview")
    return NextResponse.json({ success: false, reason: "PREVIEW_ADMIN_ONLY" }, { status: 403 });
  const secret = process.env.MARKET_INDEX_RESEARCH_PREVIEW_CRON_SECRET;
  const configured = Boolean(secret && secret.length >= 32);
  const validAccepted = configured && verifyResearchSchedulerToken("Bearer " + secret, secret) === "AUTHORIZED";
  const missingRejected = verifyResearchSchedulerToken("", secret) !== "AUTHORIZED";
  const invalidRejected = verifyResearchSchedulerToken("Bearer intentionally-invalid-token", secret) !== "AUTHORIZED";
  return NextResponse.json({
    success: configured && validAccepted && missingRejected && invalidRejected,
    mode: "AUTH_SELF_TEST_NO_NETWORK",
    configured,
    validAccepted,
    missingRejected,
    invalidRejected,
    actualHttpAuthorizationTested: false,
    writesPerformed: 0,
    schedulerEnabled: false,
  }, { headers: { "Cache-Control": "no-store" } });
}
