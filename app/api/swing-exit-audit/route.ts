import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/app/lib/auth";
import { captureSwingExitSignals, getSwingExitAuditReport } from "@/app/lib/learning/swingExitAudit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function sessionEmail() {
  const session = await getServerSession(authOptions);
  return session?.user?.email?.trim().toLowerCase() ?? null;
}

export async function GET() {
  const email = await sessionEmail();
  if (!email) return NextResponse.json({ success: false, error: "ログインが必要です" }, { status: 401 });
  try {
    const report = await getSwingExitAuditReport(email);
    return NextResponse.json({ success: true, ...report }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[swing-exit-audit] report failed", error);
    return NextResponse.json({ success: false, error: "検証結果を取得できませんでした" }, { status: 500 });
  }
}

// No prices, codes or judgement data are accepted from the browser.
// Server verifies the actual logged-in user's open positions against its scan.
export async function POST() {
  const email = await sessionEmail();
  if (!email) return NextResponse.json({ success: false, error: "ログインが必要です" }, { status: 401 });
  try {
    const report = await captureSwingExitSignals(email);
    return NextResponse.json({ success: true, ...report }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[swing-exit-audit] capture failed", error);
    return NextResponse.json({ success: false, error: "撤退判定を記録できませんでした" }, { status: 500 });
  }
}
