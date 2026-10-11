import { NextRequest, NextResponse } from "next/server";
import { requireCronAuth } from "@/app/lib/cronAuth";
import { EMA_RESEARCH_UNIVERSE } from "@/app/lib/emaRegimeResearch.ts";
import { processForwardStock } from "@/app/lib/emaForwardShadowStore";
import { shouldRunForwardOnHost } from "@/app/lib/emaForwardShadowCore.ts";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export const maxDuration=180;

export async function GET(request:NextRequest){
 const error=requireCronAuth(request);
 if(error)return error;
 // Only the explicitly enabled MAIN app runs this cron; other attached Vercel projects do nothing.
 if(!shouldRunForwardOnHost(request.nextUrl.hostname,process.env.EMA_FORWARD_SHADOW_ENABLED,process.env.VERCEL_ENV))
  return NextResponse.json({success:true,enabled:false,reason:"NOT_PRIMARY_PRODUCTION_APP"});
 const now=new Date();
 const output:Array<{code:string;status:string;reason?:string|null;actions?:number}>=[];
 const codes=EMA_RESEARCH_UNIVERSE.map(stock=>stock.code);
 // Bounded concurrency to protect the finance provider and database.
 for(let i=0;i<codes.length;i+=3){
  const batch=await Promise.all(codes.slice(i,i+3).map(async code=>{
   try{return await processForwardStock(code,now);}
   catch(e){return {code,status:"ERROR",reason:e instanceof Error?e.message:"UNKNOWN_ERROR",actions:0};}
  }));
  output.push(...batch);
 }
 const errors=output.filter(r=>r.status==="ERROR");
 return NextResponse.json({
  success:errors.length===0,enabled:true,runAt:now.toISOString(),
  processed:output.filter(r=>r.status==="PROCESSED").length,
  halted:output.filter(r=>r.status==="HALTED").length,
  skipped:output.filter(r=>r.status==="SKIPPED").length,
  errors:errors.map(r=>({code:r.code,reason:r.reason})),
  newActions:output.reduce((sum,r)=>sum+(r.actions??0),0),
 },{status:errors.length?503:200,headers:{"Cache-Control":"private, no-store"}});
}
