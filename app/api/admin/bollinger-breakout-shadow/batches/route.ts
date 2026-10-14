import {NextResponse} from "next/server";
import {getLearningOwnerSession} from "@/app/lib/learningOwner";
import {chooseBbBreakoutBatch,type BbBatchId} from "@/app/lib/research/bollingerBreakoutBatches";
import {getBollingerBatchProgress,runBollingerBatch} from "@/app/lib/research/bollingerBreakoutArchiveRunner";

export const dynamic="force-dynamic";
export const runtime="nodejs";
export const maxDuration=90;
const headers={"Cache-Control":"private, no-store"};

export async function GET(){
  if(!(await getLearningOwnerSession()).isOwner)
    return NextResponse.json({success:false,error:"OWNER_ONLY"},{status:403,headers});
  try{
    return NextResponse.json({success:true,progress:await getBollingerBatchProgress()},{headers});
  }catch{
    return NextResponse.json({success:false,error:"ARCHIVE_UNAVAILABLE"},{status:503,headers});
  }
}
export async function POST(request:Request){
  if(!(await getLearningOwnerSession()).isOwner)
    return NextResponse.json({success:false,error:"OWNER_ONLY"},{status:403,headers});
  let batch:unknown;
  try{
    if(Number(request.headers.get("content-length"))>1000)throw Error("OVERSIZED_BODY");
    const raw:unknown=await request.json();
    if(!raw||typeof raw!=="object"||Array.isArray(raw)||Object.keys(raw).length!==1)
      throw Error("INVALID_BODY");
    batch=(raw as {batch?:unknown}).batch;
    chooseBbBreakoutBatch(batch);
  }catch{
    return NextResponse.json({success:false,error:"INVALID_BATCH"},{status:400,headers});
  }
  try{
    const result=await runBollingerBatch(batch as BbBatchId);
    const ok=result.status==="COMPLETED"||result.status==="ALREADY_CLAIMED";
    return NextResponse.json({success:ok,...result},{status:ok?200:422,headers});
  }catch{
    return NextResponse.json({success:false,error:"RESEARCH_BATCH_UNAVAILABLE"},{status:503,headers});
  }
}
