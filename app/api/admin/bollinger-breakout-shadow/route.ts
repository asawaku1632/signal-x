import { NextResponse } from "next/server";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import { runBollingerReadOnlyPilot } from "@/app/lib/research/bollingerBreakoutPilot";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=45;
const headers={"Cache-Control":"private, no-store"};

export async function POST() {
  const {isOwner}=await getLearningOwnerSession();
  if(!isOwner)return NextResponse.json({success:false,error:"OWNER_ONLY"},
    {status:403,headers});
  try {
    const result=await runBollingerReadOnlyPilot();
    return NextResponse.json({success:result.status==="READY_FOR_SHADOW_COMPARISON",...result},
      {status:result.status==="READY_FOR_SHADOW_COMPARISON"?200:422,headers});
  } catch(e) {
    console.error("BB breakout SHADOW pilot failed",e instanceof Error?e.name:"UNKNOWN");
    return NextResponse.json({success:false,error:"BB_PILOT_UNAVAILABLE"},
      {status:503,headers});
  }
}
