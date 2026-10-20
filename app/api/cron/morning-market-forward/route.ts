import {NextResponse} from "next/server";
import {requireCronAuth} from "@/app/lib/cronAuth";
import {captureMorningMarketForward} from "@/app/lib/research/morningMarketForwardRunner";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=30;

export async function GET(request:Request){
  const denied=requireCronAuth(request);
  if(denied)return denied;
  try{
    const result=await captureMorningMarketForward();
    return NextResponse.json(result,{
      status:result.success?200:503,
      headers:{"Cache-Control":"private, no-store"}
    });
  }catch(error){
    console.error("[morning-market-forward] runner unavailable",error);
    return NextResponse.json({success:false,reason:"RESEARCH_UNAVAILABLE"},
      {status:503,headers:{"Cache-Control":"private, no-store"}});
  }
}
