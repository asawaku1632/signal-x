import { NextResponse } from "next/server";
import { getAdminSession } from "@/app/lib/admin";
import { buildResearchDashboardModel } from "@/app/lib/research/market-index-dashboard-model";
import { summarizeMarketIndexReadiness } from "@/app/lib/research/market-index-readiness";

export const dynamic = "force-dynamic";

/**
 * Read-only, admin-only research dashboard contract.
 * No DB/provider calls and no synthetic evidence presented as actual records.
 */
export async function GET() {
  const { isAdmin } = await getAdminSession();
  if (!isAdmin) {
    return NextResponse.json(
      { success: false, error: "OWNER_ONLY" },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }
  const result = buildResearchDashboardModel([]);
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: "RESEARCH_MODEL_UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json({
    success: true,
    sourceState: "NO_CONNECTED_EVIDENCE",
    hasLiveEvidence: false,
    model: result.model,
    readiness: summarizeMarketIndexReadiness({
      providerRightsVerified: false,
      licensedEvidenceAuthenticated: false,
      exchangeCalendarAuthenticated: false,
      observedMarketDataValidated: false,
      scheduledCaptureConfigured: false,
      databasePersistenceConfigured: false,
    }),
  }, { headers: { "Cache-Control": "no-store" } });
}
