import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/lib/auth";
import { getSwingUniverseReport } from "@/app/lib/learning/swingUniverseAudit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ success: false, error: "ログインが必要です" }, { status: 401 });
  }
  try {
    const code = new URL(request.url).searchParams.get("code")?.trim() || undefined;
    if (code && !/^[0-9]{4}$/.test(code)) {
      return NextResponse.json({ success: false, error: "銘柄コードは4桁で指定してください" }, { status: 400 });
    }
    const report = await getSwingUniverseReport(code);
    return NextResponse.json({ success: true, ...report }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[swing-universe-audit] report failed", error);
    return NextResponse.json({ success: false, error: "検証データの取得に失敗しました" }, { status: 500 });
  }
}
