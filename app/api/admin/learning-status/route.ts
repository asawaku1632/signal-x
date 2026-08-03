import { NextResponse } from "next/server";

import { getAdminSession } from "@/app/lib/admin";
import { getLearningSaveStatus } from "@/app/lib/learning/learningSaveStatus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const { isAdmin } = await getAdminSession();

  if (!isAdmin) {
    return NextResponse.json(
      { success: false, error: "Administrator access required" },
      { status: 403 },
    );
  }

  try {
    const status = await getLearningSaveStatus();
    return NextResponse.json(
      { success: true, ...status },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("learning status api error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "AI学習保存状況を取得できませんでした",
      },
      { status: 500 },
    );
  }
}
