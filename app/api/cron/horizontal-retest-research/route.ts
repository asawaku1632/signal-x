import { NextResponse } from "next/server";
import { requireCronAuth } from "@/app/lib/cronAuth";
import { ACTIVE_STOCKS } from "@/app/lib/activeStockList";
import { selectHorizontalAutoDailyStocks } from "@/app/lib/research/horizontalAutoPolicy";
import { getHorizontalAutoEnabled } from "@/app/lib/research/horizontalAutoSwitch";
import { runHorizontalAutoDaily } from "@/app/lib/research/horizontalAutoRunner";
import { getMsbAutoEnabled } from "@/app/lib/research/msbAutoSwitch";
import { runMsbAutoSolo } from "@/app/lib/research/msbAutoRunner";

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
    const [horizontalOn,msbOn] = await Promise.all([
      getHorizontalAutoEnabled(),getMsbAutoEnabled(),
    ]);
    if(!horizontalOn&&!msbOn){
      return NextResponse.json({success:true,skipped:true,reason:"BOTH_FEATURES_DISABLED"});
    }
    if(horizontalOn){
      // The usual five-stock Yahoo batch is shared with MSB only when opted in.
      const horizontal=await runHorizontalAutoDaily(new Date(),msbOn);
      if(msbOn&&horizontal.skipped&&horizontal.reason==="NO_ELIGIBLE_STOCKS"){
        const msb=await runMsbAutoSolo();
        return NextResponse.json({success:horizontal.success&&msb.success,horizontal,msb},
          {status:horizontal.success&&msb.success?200:503});
      }
      return NextResponse.json(horizontal,{status:horizontal.success?200:503});
    }
    // The horizontal study is OFF: MSB uses the very same cron slot, max 5 codes.
    const msb=await runMsbAutoSolo();
    return NextResponse.json({success:msb.success,horizontal:{skipped:true,reason:"FEATURE_DISABLED"},msb},
      {status:msb.success?200:503});
  } catch (e) {
    console.error("isolated research cron preclaim unavailable",e);
    return NextResponse.json({success:false,error:"HORIZONTAL_AUTO_UNAVAILABLE"},{status:503});
  }
}
