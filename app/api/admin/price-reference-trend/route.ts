import { NextResponse } from "next/server";
import { getAdminSession } from "@/app/lib/admin";
import { getPriceReferenceTrend } from "@/app/lib/learning/priceReferenceTrend";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const { isAdmin } = await getAdminSession();
  if (!isAdmin) return NextResponse.json({ success: false, error: "管理者権限が必要です" }, {
    status: 403, headers: { "Cache-Control": "private, no-store" },
  });
  try {
    const report = await getPriceReferenceTrend();
    return NextResponse.json({ success: true, checkedAt: new Date().toISOString(), ...report }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("[price-reference-trend] read-only report unavailable", error);
    return NextResponse.json({ success: false, error: "参考価格の集計に失敗しました" }, {
      status: 503, headers: { "Cache-Control": "private, no-store" },
    });
  }
}
