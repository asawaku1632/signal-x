import {NextResponse} from "next/server";
import {getLearningOwnerSession} from "@/app/lib/learningOwner";
import {prospectiveProgress,setProspectiveEnabled} from "@/app/lib/research/bollingerForwardRunner";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=20;
const headers={"Cache-Control":"private, no-store"};
export async function GET(){
 if(!(await getLearningOwnerSession()).isOwner)
  return NextResponse.json({success:false,error:"OWNER_ONLY"},{status:403,headers});
 try{return NextResponse.json({success:true,report:await prospectiveProgress()},{headers});}
 catch{return NextResponse.json({success:false,error:"FORWARD_STATUS_UNAVAILABLE"},{status:503,headers});}
}
export async function POST(request:Request){
 if(!(await getLearningOwnerSession()).isOwner)
  return NextResponse.json({success:false,error:"OWNER_ONLY"},{status:403,headers});
 let enabled:unknown;
 try{
  if(Number(request.headers.get("content-length"))>1000)throw Error("TOO_LARGE");
  const body:unknown=await request.json();
  if(!body||Array.isArray(body)||typeof body!=="object"||
   Object.keys(body).length!==1)throw Error("BAD_BODY");
  enabled=(body as {enabled:unknown}).enabled;
  if(typeof enabled!=="boolean")throw Error("BAD_ENABLED");
 }catch{return NextResponse.json({success:false,error:"INVALID_CONTROL"},{status:400,headers});}
 try{
  const report=await setProspectiveEnabled(enabled);
  return NextResponse.json({success:true,report},{headers});
 }catch{return NextResponse.json({success:false,error:"FORWARD_CONTROL_UNAVAILABLE"},{status:503,headers});}
}
