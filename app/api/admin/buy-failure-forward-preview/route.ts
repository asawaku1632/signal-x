import { NextResponse } from "next/server";
import { getAdminSession } from "@/app/lib/admin";
import { previewBuySignalForward } from "@/app/lib/research/buyFailureForwardPreview";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const { isAdmin } = await getAdminSession();
  if (!isAdmin) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  try {
    const preview = await previewBuySignalForward(20);
    return NextResponse.json({ success: true, mode: "OWNER_READ_ONLY_UNVERIFIED_FORWARD_PREVIEW", ...preview },
      { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[buy-failure-forward-preview] failed", error);
    return NextResponse.json({ success: false, error: "Research unavailable" }, { status: 503,
      headers: { "Cache-Control": "private, no-store" } });
  }
}
