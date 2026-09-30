import { NextResponse } from "next/server";
import { getLatestScanSnapshot, refreshScanSnapshot, SCAN_FRESH_MS } from "@/app/lib/scanSnapshot";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  try {
    const snapshot = await getLatestScanSnapshot();
    const stocks = Array.isArray(snapshot?.payload?.stocks) ? snapshot.payload.stocks : [];
    const ageMs = snapshot ? Date.now() - Date.parse(snapshot.updatedAt) : Infinity;

    // 疑似投資画面では、保存済みスナップショットを即返す。
    // 鮮度更新のためにユーザーを待たせない。
    if (stocks.length > 0) {
      return NextResponse.json(
        {success:true,count:stocks.length,updatedAt:snapshot?.updatedAt??null,stale:ageMs>=SCAN_FRESH_MS,stocks},
        {headers:{"Cache-Control":"private, max-age=30, stale-while-revalidate=300"}}
      );
    }

    // 初回など保存済みデータがない場合だけ同期更新する。
    const refreshed = await refreshScanSnapshot(1200, snapshot) ?? await getLatestScanSnapshot();
    const refreshedStocks = Array.isArray(refreshed?.payload?.stocks) ? refreshed.payload.stocks : [];
    return NextResponse.json({success:true,count:refreshedStocks.length,updatedAt:refreshed?.updatedAt??null,stale:false,stocks:refreshedStocks});
  } catch (error) {
    console.error("simulation stocks error", error);
    return NextResponse.json({success:false,error:"銘柄データの取得に失敗しました",stocks:[]},{status:500});
  }
}
