import { NextResponse } from "next/server";
import { getLatestScanSnapshot, refreshScanSnapshot, SCAN_FRESH_MS } from "@/app/lib/scanSnapshot";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  try {
    let snapshot = await getLatestScanSnapshot();
    const ageMs = snapshot ? Date.now() - Date.parse(snapshot.updatedAt) : Infinity;
    if (!snapshot || !Array.isArray(snapshot.payload?.stocks) || snapshot.payload.stocks.length === 0 || ageMs >= SCAN_FRESH_MS) {
      snapshot = await refreshScanSnapshot(1200, snapshot) ?? await getLatestScanSnapshot();
    }
    const stocks = Array.isArray(snapshot?.payload?.stocks) ? snapshot.payload.stocks : [];
    return NextResponse.json({success:true,count:stocks.length,updatedAt:snapshot?.updatedAt??null,stocks});
  } catch (error) {
    console.error("simulation stocks error", error);
    return NextResponse.json({success:false,error:"銘柄データの取得に失敗しました",stocks:[]},{status:500});
  }
}
