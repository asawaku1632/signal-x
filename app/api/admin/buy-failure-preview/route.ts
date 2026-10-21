import { NextResponse } from "next/server";
import { getAdminSession } from "@/app/lib/admin";
import { getBuyActivationPreview } from "@/app/lib/research/buyFailureReadOnly";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { isAdmin } = await getAdminSession();
  if (!isAdmin) return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403, headers: { "Cache-Control": "private, no-store" } });
  try {
    const preview = await getBuyActivationPreview();
    return NextResponse.json({
      success: true,
      mode: "OWNER_READ_ONLY_UNVERIFIED_HISTORICAL_PREVIEW",
      ...preview,
      disclaimer: "Historical activations only; quote freshness and future outcomes unverified.",
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[buy-failure-preview] unavailable", error);
    return NextResponse.json({ success: false, error: "Research preview unavailable" },
      { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
