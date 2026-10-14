import {NextResponse} from "next/server";
import {getLearningOwnerSession} from "@/app/lib/learningOwner";
import {chooseBbBreakoutBatch,type BbBatchId} from "@/app/lib/research/bollingerBreakoutBatches";
import {runVolumeFactorBatch,volumeFactorProgress} from "@/app/lib/research/bollingerVolumeFactorRunner";

export const dynamic="force-dynamic";
export const runtime="nodejs";
export const maxDuration=90;
const headers={"Cache-Control":"private, no-store"};

export async function GET(){
  if(!(await getLearningOwnerSession()).isOwner)
    return NextResponse.json({success:false,error:"OWNER_ONLY"},{status:403,headers});
  try{
    return NextResponse.json({success:true,progress:await volumeFactorProgress()},{headers});
  }catch{return NextResponse.json({success:false,error:"VOLUME_STUDY_UNAVAILABLE"},{status:503,headers});}
}
export async function POST(request:Request){
  if(!(await getLearningOwnerSession()).isOwner)
    return NextResponse.json({success:false,error:"OWNER_ONLY"},{status:403,headers});
  let batch:unknown;
  try{
    if(Number(request.headers.get("content-length"))>1000)throw Error("TOO_LARGE");
    const input:unknown=await request.json();
    if(!input||typeof input!=="object"||Array.isArray(input)||
      Object.keys(input).length!==1)throw Error("INVALID_BODY");
    batch=(input as {batch?:unknown}).batch;
    chooseBbBreakoutBatch(batch);
  }catch{return NextResponse.json({success:false,error:"INVALID_BATCH"},{status:400,headers});}
  try{
    const result=await runVolumeFactorBatch(batch as BbBatchId);
    const good=result.status==="COMPLETE"||result.status==="ALREADY_CLAIMED";
    return NextResponse.json({success:good,...result},{status:good?200:422,headers});
  }catch{return NextResponse.json({success:false,error:"VOLUME_STUDY_UNAVAILABLE"},{status:503,headers});}
}
