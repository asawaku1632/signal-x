import { NextResponse } from "next/server";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import { getNotificationResearchEvidence } from "@/app/lib/push/notificationResearchEvidence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Private, read-only evidence from historical snapshots; no push, LINE, orders,
// or research approval is modified by inspecting this endpoint.
export async function GET() {
  const owner = await getLearningOwnerSession();
  if (!owner.isOwner) {
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  }
  try {
    const evidence = await getNotificationResearchEvidence();
    return NextResponse.json({ success: true, ...evidence }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    console.error("[push-research] read-only verification query failed");
    return NextResponse.json({ success: false, error: "Research status unavailable" }, { status: 503 });
  }
}
