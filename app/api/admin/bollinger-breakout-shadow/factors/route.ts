import {NextResponse} from "next/server";
import {getLearningOwnerSession} from "@/app/lib/learningOwner";
import {runAsOfFactorBatch,getAsOfFactorProgress} from "@/app/lib/research/bollingerAsOfFactorRunner";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=90;
const headers={"Cache-Control":"private, no-store"};
export async function GET(){
 if(!(await getLearningOwnerSession()).isOwner)
  return NextResponse.json({success:false,error:"OWNER_ONLY"},{status:403,headers});
 try{return NextResponse.json({success:true,progress:await getAsOfFactorProgress()},{headers});}
 catch{return NextResponse.json({success:false,error:"RESEARCH_DATA_UNAVAILABLE"},{status:503,headers});}
}
export async function POST(req:Request){
 if(!(await getLearningOwnerSession()).isOwner)
  return NextResponse.json({success:false,error:"OWNER_ONLY"},{status:403,headers});
 let batch:unknown;
 try{
  if(Number(req.headers.get("content-length"))>1000)throw Error("TOO_LARGE");
  const input:unknown=await req.json();
  if(!input||typeof input!=="object"||Array.isArray(input)||
    Object.keys(input).length!==1)throw Error("INVALID_BODY");
  batch=(input as {batch?:unknown}).batch;
  if(typeof batch!=="number"||!Number.isInteger(batch)||batch<0||batch>19)
   throw Error("INVALID_BATCH");
 }catch{return NextResponse.json({success:false,error:"INVALID_BATCH"},{status:400,headers});}
 try{
  const result=await runAsOfFactorBatch(batch as number);
  const good=result.status==="COMPLETED"||result.status==="ALREADY_COMPLETED"||
   result.status==="ALREADY_CLAIMED";
  return NextResponse.json({success:good,...result},{status:good?200:422,headers});
 }catch{return NextResponse.json({success:false,error:"FACTOR_STUDY_UNAVAILABLE"},{status:503,headers});}
}
