import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/lib/auth";
import { getSwingConflictAuditReport } from "@/app/lib/learning/swingConflictAudit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Read-only. Not a cron, notification, or an execution decision.
export async function GET() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ success: false, error: "ログインが必要です" }, { status: 401 });
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
