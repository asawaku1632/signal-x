import {NextResponse} from "next/server";
import {requireCronAuth} from "@/app/lib/cronAuth";
import {runCrashForwardDaily} from "@/app/lib/research/crashForwardRunner";
import {shouldRunCrashForwardOnHost} from "@/app/lib/research/crashForwardCore.mjs";

export const dynamic="force-dynamic";
export const runtime="nodejs";
export const maxDuration=120;

export async function GET(request:Request){
 const unauthorized=requireCronAuth(request);
 if(unauthorized)return unauthorized;
 const hostname=new URL(request.url).hostname;
 if(!shouldRunCrashForwardOnHost(hostname,process.env.VERCEL_ENV))
  return NextResponse.json({success:true,enabled:false,reason:"NOT_PRIMARY_PRODUCTION_HOST"});
 // Explicit emergency stop: set to 'false' without touching other AI/LINE jobs.
 if(process.env.CRASH_FORWARD_AUTO_ENABLED==="false")
  return NextResponse.json({success:true,enabled:false,reason:"DISABLED_BY_KILL_SWITCH"});
 try {
  const report=await runCrashForwardDaily();
  return NextResponse.json(report,{status:report.success?200:503,
   headers:{"Cache-Control":"private, no-store"}});
 }catch(error){
  console.error("[crash-forward] isolated research failed",
    error instanceof Error?error.message:"UNKNOWN");
  return NextResponse.json({success:false,error:"CRASH_FORWARD_RESEARCH_UNAVAILABLE"},
    {status:503,headers:{"Cache-Control":"private, no-store"}});
 }
}
