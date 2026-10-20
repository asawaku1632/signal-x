import {NextResponse} from "next/server";
import {requireCronAuth} from "@/app/lib/cronAuth";
import {runWeakReboundResearch} from "@/app/lib/research/weakAiReboundRunner";

export const dynamic="force-dynamic";
export const runtime="nodejs";
export const maxDuration=60;

export async function GET(request:Request){
  const unauthorized=requireCronAuth(request);
  if(unauthorized)return unauthorized;
  const phase=new URL(request.url).searchParams.get("phase")??"";
  if(!["freeze","entry","outcomes"].includes(phase))
    return NextResponse.json({success:false,reason:"INVALID_PHASE"},{status:400});
  try{
    const result=await runWeakReboundResearch(phase);
    return NextResponse.json(result,{status:result.success?200:503,
      headers:{"Cache-Control":"private,no-store"}});
  }catch(error){
    console.error("weak rebound research cron failed",error);
    return NextResponse.json({success:false,reason:"RESEARCH_UNAVAILABLE"},
      {status:503,headers:{"Cache-Control":"private,no-store"}});
  }
}
