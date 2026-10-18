import { NextResponse } from "next/server";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import { getSwingBenchmarkEvidence } from "@/app/lib/push/swingBenchmarkEvidence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Owner-only, read-only 5-session research. Does not alter ANY alerts,
// sell/buy decisions, weights, schedules, or saved stock histories.
export async function GET() {
  const owner=await getLearningOwnerSession();
  if(!owner.isOwner){
    return NextResponse.json({success:false,error:"Not found"},{status:404});
  }
  try{
    const report=await getSwingBenchmarkEvidence();
    return NextResponse.json({success:true,...report},{
      headers:{"Cache-Control":"private, no-store"},
    });
  }catch(error){
    console.error("[swing-benchmark] isolated read-only comparison failed",error);
    return NextResponse.json({success:false,error:"Swing comparison unavailable"},{status:503});
  }
}
