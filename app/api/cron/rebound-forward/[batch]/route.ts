import { NextRequest, NextResponse } from "next/server";
import { requireCronAuth } from "@/app/lib/cronAuth";
import { reboundAutoPreflight, shouldRunReboundOnHost } from "@/app/lib/research/supportReboundAutoCore";
import { runReboundAutoBatch } from "@/app/lib/research/supportReboundAutoRunner";

export const dynamic="force-dynamic";
export const runtime="nodejs";
export const maxDuration=240; // Pro Function; 50 stocks per invocation, max five concurrent

export async function GET(request:NextRequest,{params}:{params:Promise<{batch:string}>}){
  const invalid=requireCronAuth(request);
  if(invalid)return invalid;
  if(!shouldRunReboundOnHost(request.nextUrl.hostname,process.env.VERCEL_ENV))
    return NextResponse.json({success:true,skipped:true,reason:"NOT_PRIMARY_PRODUCTION_HOST"});
  const {batch:raw}=await params;
  if(raw!=="0"&&raw!=="1")
    return NextResponse.json({success:false,error:"INVALID_BATCH"},{status:400});
  // Calendar and completed-market guard precede any database/network calls.
  const preflight=reboundAutoPreflight(new Date());
  if(!preflight.ok)
    return NextResponse.json({success:true,skipped:true,reason:preflight.reason,date:preflight.date});
  try{
    const result=await runReboundAutoBatch(raw==="0"?0:1);
    return NextResponse.json(result,{status:result.success?200:503,
      headers:{"Cache-Control":"private, no-store"}});
  }catch(error){
    console.error("rebound forward cron execution failed",error);
    return NextResponse.json({success:false,error:"RESEARCH_AUTO_UNAVAILABLE"},{status:503});
  }
}
