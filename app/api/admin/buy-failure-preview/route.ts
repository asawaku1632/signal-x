import { NextResponse } from "next/server";
import { getAdminSession } from "@/app/lib/admin";
import { isAuthorizedResearchOwner, RESEARCH_PRIVATE_HEADERS } from "@/app/lib/research/ownerPreviewPolicy.mjs";
import { getBuyActivationPreview } from "@/app/lib/research/buyFailureReadOnly";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { isAdmin } = await getAdminSession();
  if (!isAuthorizedResearchOwner(isAdmin)) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403, headers: RESEARCH_PRIVATE_HEADERS });
  try {
    const preview = await getBuyActivationPreview();
    return NextResponse.json({
      success: true,
      mode: "OWNER_READ_ONLY_UNVERIFIED_HISTORICAL_PREVIEW",
      ...preview,
      disclaimer: "Historical activations only; quote freshness and future outcomes unverified.",
    }, { headers: RESEARCH_PRIVATE_HEADERS });
  } catch (error) {
    console.error("[buy-failure-preview] unavailable", error);
    return NextResponse.json({ success: false, error: "Research preview unavailable" },
      { status: 503, headers: RESEARCH_PRIVATE_HEADERS });
  }
}
