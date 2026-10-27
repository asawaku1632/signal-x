import { NextResponse } from "next/server";
import { getAdminSession } from "@/app/lib/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Disabled by design: no scheduler, credentials, DB writes or market data access.
export async function GET() {
  const { isAdmin } = await getAdminSession();
  if (!isAdmin || process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ success: false, reason: "PREVIEW_ADMIN_ONLY" }, { status: 403 });
  }
  const enabled = process.env.MARKET_INDEX_RESEARCH_DEV_READ_ENABLED === "true";
  const raw = process.env.MARKET_INDEX_RESEARCH_DEV_DATABASE_URL;
  let devDatabaseIdentityValid = false;
  if (enabled && raw) {
    try {
      const url = new URL(raw);
      devDatabaseIdentityValid =
        ["postgres:", "postgresql:"].includes(url.protocol) &&
        url.hostname === "aws-0-ap-northeast-1.pooler.supabase.com" &&
        decodeURIComponent(url.username) === "postgres.jdtqwryiyxeuoraecorw" &&
        url.port === "5432" && url.pathname === "/postgres" && Boolean(url.password);
    } catch {
      devDatabaseIdentityValid = false;
    }
  }
  return NextResponse.json({
    success: true,
    mode: "DRY_RUN_ONLY",
    enabled: false,
    scheduled: false,
    timezone: "Asia/Tokyo",
    proposedTimeJst: "17:30",
    indices: ["nikkei", "topix"],
    wouldRecord: { status: "unavailable", reason: "PROVIDER_APPROVAL_REQUIRED", providerRightsVerified: false },
    devDatabaseOnly: true,
    devDatabaseIdentityValid,
    devDatabaseWriteAttempted: false,
    marketDataCaptured: false,
    writesPerformed: 0,
    checks: {
      previewAdminAuthorized: true,
      isolatedDevDatabaseIdentity: devDatabaseIdentityValid,
      schedulerAuthentication: "NOT_IMPLEMENTED",
      concurrentJstDeduplication: "MANUAL_TEST_ONLY",
      failureAndRetry: "NOT_TESTED",
      activation: "DISABLED",
    },
    requiredBeforeActivation: [
      "Preview-only scheduler with independently verified authentication",
      "Development database identity verification",
      "JST date deduplication under concurrent execution",
      "Failure and retry tests",
      "Explicit activation approval",
    ],
  }, { headers: { "Cache-Control": "no-store" } });
}
