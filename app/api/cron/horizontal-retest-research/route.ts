import { NextResponse } from "next/server";
import { requireCronAuth } from "@/app/lib/cronAuth";
import { ACTIVE_STOCKS } from "@/app/lib/activeStockList";
import { selectHorizontalAutoDailyStocks } from "@/app/lib/research/horizontalAutoPolicy";
import { getHorizontalAutoEnabled } from "@/app/lib/research/horizontalAutoSwitch";
import { runHorizontalAutoDaily } from "@/app/lib/research/horizontalAutoRunner";
import { getMsbAutoEnabled } from "@/app/lib/research/msbAutoSwitch";
import { runMsbAutoSolo } from "@/app/lib/research/msbAutoRunner";
import { runMsbScaleDaily, type ScaleResult } from "@/app/lib/research/msbScaleRunner";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;

/** Called by Vercel Cron at 23:50 UTC Sun-Thu == 08:50 JST Mon-Fri.
 * Separate from all AI/learning/notifications and failed closed by DB switch.
 */
export async function GET(request: Request) {
  const invocationStartedMs=Date.now();
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
        const scale=await tryScale(msb.success&&msb.status==="COMPLETED",
          msb.dateJst,invocationStartedMs);
        return NextResponse.json({success:horizontal.success&&msb.success,horizontal,msb,scale},
          {status:horizontal.success&&msb.success?200:503});
      }
      const scale=await tryScale(msbOn&&horizontal.success&&
        horizontal.msb?.status==="COMPLETED",horizontal.dateJst,invocationStartedMs);
      return NextResponse.json({...horizontal,scale},{status:horizontal.success?200:503});
    }
    // The horizontal study is OFF: MSB uses the very same cron slot, max 5 codes.
    const msb=await runMsbAutoSolo();
    const scale=await tryScale(msb.success&&msb.status==="COMPLETED",
      msb.dateJst,invocationStartedMs);
    return NextResponse.json({success:msb.success,horizontal:{skipped:true,reason:"FEATURE_DISABLED"},msb,scale},
      {status:msb.success?200:503});
  } catch (e) {
    console.error("isolated research cron preclaim unavailable",e);
    return NextResponse.json({success:false,error:"HORIZONTAL_AUTO_UNAVAILABLE"},{status:503});
  }
}

/** Independent shadow research failure must NEVER turn the existing horizontal
 * successful daily Cron into a failed production request.
 */
async function tryScale(eligible:boolean,day:string,startedMs:number):Promise<ScaleResult|undefined>{
  if(!eligible)return undefined;
  try{return await runMsbScaleDaily(new Date(),startedMs);}
  catch(error){
    console.error("MSB 50-stock expansion unavailable",error);
    return {status:"FAILED",dateJst:day,batchesCompleted:0,stocksAdded:0,reason:"SCALE_ERROR"};
  }
}
