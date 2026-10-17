import {NextResponse} from "next/server";
import {getLearningOwnerSession} from "@/app/lib/learningOwner";
import {getExpansionBatch} from "@/app/lib/research/bollingerExpansionUniverse";
import {bbExpansionProgress,runBbExpansion} from "@/app/lib/research/bollingerExpansionRunner";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=90;
const headers={"Cache-Control":"private, no-store"};

export async function GET(){
 if(!(await getLearningOwnerSession()).isOwner)
   return NextResponse.json({success:false,error:"OWNER_ONLY"},{status:403,headers});
 try{
  return NextResponse.json({success:true,progress:await bbExpansionProgress()},{headers});
 }catch{return NextResponse.json({success:false,error:"EXPANSION_PROGRESS_UNAVAILABLE"},{status:503,headers});}
}
export async function POST(req:Request){
 if(!(await getLearningOwnerSession()).isOwner)
   return NextResponse.json({success:false,error:"OWNER_ONLY"},{status:403,headers});
 if(process.env.VERCEL_ENV!=="production")
   return NextResponse.json({success:false,error:"EXPANSION_PREVIEW_WRITE_BLOCKED"},{status:403,headers});
 let batch:unknown;
 try{
  if(Number(req.headers.get("content-length"))>1000)throw Error("BODY_TOO_LARGE");
  const input:unknown=await req.json();
  if(!input||typeof input!=="object"||Array.isArray(input)||Object.keys(input).length!==1)
    throw Error("INVALID_BODY");
  batch=(input as {batch?:unknown}).batch;
  getExpansionBatch(batch);
 }catch{
  return NextResponse.json({success:false,error:"INVALID_BATCH"},{status:400,headers});
 }
 try{
  const result=await runBbExpansion(batch as number);
  const good=result.status==="COMPLETE"||result.status==="ALREADY_COMPLETE"||
    result.status==="ALREADY_CLAIMED";
  return NextResponse.json({success:good,...result},{status:good?200:422,headers});
 }catch{return NextResponse.json({success:false,error:"EXPANSION_UNAVAILABLE"},{status:503,headers});}
}
