import {NextRequest,NextResponse} from "next/server";
import {getLearningOwnerSession} from "@/app/lib/learningOwner";
import {captureBudgetUniverseShadow} from "@/app/lib/research/budgetUniverseFreezeRunner";
export const dynamic="force-dynamic";
export const runtime="nodejs";
/** No GET mutation, no cron schedule, no feature available to ordinary users. */
export async function POST(request:NextRequest){
  const {isOwner}=await getLearningOwnerSession();
  if(!isOwner)return NextResponse.json({success:false,error:"NOT_FOUND"},{status:404});
  const origin=request.headers.get("origin");
  if(!origin||origin!==new URL(request.url).origin)
    return NextResponse.json({success:false,error:"ORIGIN_NOT_ALLOWED"},{status:403});
  if(process.env.BUDGET_UNIVERSE_SHADOW_WRITE_ENABLED!=="true")
    return NextResponse.json({success:false,error:"NOT_ENABLED"},{status:403});
  try{
    const result=await captureBudgetUniverseShadow();
    return NextResponse.json(result,{status:result.success?200:409,
      headers:{"Cache-Control":"no-store"}});
  }catch(error){
    console.error("Budget universe freeze research failed",error);
    return NextResponse.json({success:false,error:"RESEARCH_UNAVAILABLE"},
      {status:503,headers:{"Cache-Control":"no-store"}});
  }
}
