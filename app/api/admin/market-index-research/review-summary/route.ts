import { NextResponse } from "next/server";
import { getAdminSession } from "@/app/lib/admin";
import { buildResearchDashboardModel } from "@/app/lib/research/market-index-dashboard-model";

export const dynamic = "force-dynamic";

/**
 * Research-only, read-only, empty-state contract.
 * No provider, DB, synthetic fixture, or production data is loaded.
 */
export async function GET() {
  const { isAdmin } = await getAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: "管理者権限が必要です" }, {
      status: 403, headers: { "Cache-Control": "no-store" },
    });
  }
  const result = buildResearchDashboardModel([]);
  if (!result.ok) {
    return NextResponse.json({ success: false, error: "RESEARCH_MODEL_UNAVAILABLE" }, {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }
  return NextResponse.json({
    success: true,
    dataOrigin: "NO_DATA_CONNECTED",
    dataIsLive: false,
    ...result.model,
  }, { headers: { "Cache-Control": "no-store" } });
}
