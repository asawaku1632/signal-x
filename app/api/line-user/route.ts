import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/lib/auth";
import { createLineLinkToken, getLineBinding } from "@/app/lib/line/linking";

export async function GET() {
  const session = await getServerSession(authOptions);
  const signalxUserId = session?.user?.id;
  if (!signalxUserId) {
    return NextResponse.json({ success: false, error: "ログインが必要です" }, { status: 401 });
  }

  const binding = await getLineBinding(signalxUserId);
  return NextResponse.json({ success: true, linked: Boolean(binding), linkedAt: binding?.linked_at ?? null });
}

export async function POST() {
  const session = await getServerSession(authOptions);
  const signalxUserId = session?.user?.id;
  if (!signalxUserId) {
    return NextResponse.json({ success: false, error: "ログインが必要です" }, { status: 401 });
  }

  const token = await createLineLinkToken({
    signalxUserId,
    userEmail: session.user?.email,
  });

  return NextResponse.json({
    success: true,
    token,
    expiresInSeconds: 600,
    instructions: "このトークンをLINE公式アカウントへ送信して連携を完了します",
  });
}
