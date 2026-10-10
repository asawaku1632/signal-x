import { NextResponse } from "next/server";
import { getAdminSession } from "@/app/lib/admin";
import { getAvailablePriceReferenceDates, getSuggestedPriceReferenceBatch } from "@/app/lib/learning/priceReferenceSampleRepository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };

// Read-only admin request. No Yahoo, no cron and no write side effects.
export async function GET(request: Request) {
  const { isAdmin } = await getAdminSession();
  if (!isAdmin) return NextResponse.json(
    { success: false, error: "管理者権限が必要です" },
    { status: 403, headers },
  );
  const params = new URL(request.url).searchParams;
  try {
    if (params.get("mode") === "dates") {
      const dates = await getAvailablePriceReferenceDates();
      return NextResponse.json({ success: true, dates }, { headers });
    }
    const suggestions = await getSuggestedPriceReferenceBatch(params.get("date"));
    return NextResponse.json({ success: true, ...suggestions }, { headers });
  } catch (error) {
    const name = error instanceof Error ? error.message : "";
    if (name === "INVALID_TRADE_DATE" || name === "OUTSIDE_RESEARCH_WINDOW")
      return NextResponse.json({ success: false, error: "過去90日以内の取引日を指定してください" },
        { status: 400, headers });
    if (name === "INSUFFICIENT_DAILY_COVERAGE")
      return NextResponse.json({ success: false, error: "保存済み銘柄の件数が不足しています。候補選定を保留しました。" },
        { status: 422, headers });
    console.error("[price-reference-sample] read-only candidate selection unavailable", error);
    return NextResponse.json({ success: false, error: "候補選定に失敗しました" },
      { status: 503, headers });
  }
}
