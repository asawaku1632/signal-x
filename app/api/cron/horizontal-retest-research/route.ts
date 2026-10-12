import { NextResponse } from "next/server";
import { requireCronAuth } from "@/app/lib/cronAuth";
import { ACTIVE_STOCKS } from "@/app/lib/activeStockList";
import { selectHorizontalAutoDailyStocks } from "@/app/lib/research/horizontalAutoPolicy";
import { getHorizontalAutoEnabled } from "@/app/lib/research/horizontalAutoSwitch";
import { runHorizontalAutoDaily } from "@/app/lib/research/horizontalAutoRunner";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

/** Called by Vercel Cron at 23:50 UTC Sun-Thu == 08:50 JST Mon-Fri.
 * Separate from all AI/learning/notifications and failed closed by DB switch.
 */
export async function GET(request: Request) {
  const unauthorized=requireCronAuth(request);
  if (unauthorized) return unauthorized;
  const preflight=selectHorizontalAutoDailyStocks({
    now:new Date(),universe:ACTIVE_STOCKS.map(x=>String(x.code)),
    coveredCodes:new Set(),
  });
  if (!preflight.ok) {
    return NextResponse.json({success:true,skipped:true,
      dateJst:preflight.dateJst,reason:preflight.reason});
  }
  try {
    if (!(await getHorizontalAutoEnabled())) {
      return NextResponse.json({success:true,skipped:true,reason:"FEATURE_DISABLED"});
    }
    const result=await runHorizontalAutoDaily();
    return NextResponse.json(result,{status:result.success?200:503});
  } catch (e) {
    console.error("horizontal auto preclaim unavailable",e);
    return NextResponse.json({success:false,error:"HORIZONTAL_AUTO_UNAVAILABLE"},{status:503});
  }
}
