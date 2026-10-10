import { NextResponse } from "next/server";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import { getSwingConflictAuditReport } from "@/app/lib/learning/swingConflictAudit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Read-only. Not a cron, notification, or an execution decision.
export async function GET() {
  const { email, isOwner } = await getLearningOwnerSession();
  if (!email) {
    return NextResponse.json({ success: false, error: "ログインが必要です" }, { status: 401 });
  }
  if (!isOwner) {
    return NextResponse.json({ success: false, error: "閲覧権限がありません" }, { status: 403, headers: { "Cache-Control": "private, no-store" } });
  }
  try {
    const report = await getSwingConflictAuditReport(email);
    return NextResponse.json({ success: true, ...report }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("[swing-conflict-audit] report failed", error);
    return NextResponse.json({ success: false, error: "重複シグナルの検証データを取得できませんでした" }, { status: 500 });
  }
}
