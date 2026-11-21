import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/lib/auth";
import {
  captureSwingDecisionForward,
  getSwingDecisionForwardReport,
} from "@/app/lib/learning/swingDecisionForward";

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
    const report = await getSwingDecisionForwardReport(email);
    return NextResponse.json({ success: true, ...report }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("[swing-decision-forward] report failed", error);
    return NextResponse.json({ success: false, error: "検証結果を取得できませんでした" }, { status: 500 });
  }
}

// Browser sends no stock, price or AI judgement. All inputs are verified on the server.
export async function POST() {
  const email = await sessionEmail();
  if (!email) return NextResponse.json({ success: false, error: "ログインが必要です" }, { status: 401 });
  try {
    const result = await captureSwingDecisionForward("MANUAL", email);
    return NextResponse.json({ success: true, ...result }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("[swing-decision-forward] capture failed", error);
    return NextResponse.json({ success: false, error: "判定を保存できませんでした" }, { status: 500 });
  }
}
