import { NextResponse } from "next/server";
import { getAdminSession } from "@/app/lib/admin";
import { isAuthorizedResearchOwner, RESEARCH_PRIVATE_HEADERS } from "@/app/lib/research/ownerPreviewPolicy.mjs";
import { previewBuySignalForward } from "@/app/lib/research/buyFailureForwardPreview";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const { isAdmin } = await getAdminSession();
  if (!isAuthorizedResearchOwner(isAdmin)) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403, headers: RESEARCH_PRIVATE_HEADERS });
  try {
    const preview = await previewBuySignalForward(20);
    return NextResponse.json({ success: true, mode: "OWNER_READ_ONLY_UNVERIFIED_FORWARD_PREVIEW", ...preview },
      { headers: RESEARCH_PRIVATE_HEADERS });
  } catch (error) {
    console.error("[buy-failure-forward-preview] failed", error);
    return NextResponse.json({ success: false, error: "Research unavailable" }, { status: 503,
      headers: RESEARCH_PRIVATE_HEADERS });
  }
}
