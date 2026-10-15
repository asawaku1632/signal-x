import {NextResponse} from "next/server";
import {getLearningOwnerSession} from "@/app/lib/learningOwner";
import {getCombinedBollingerStudy} from "@/app/lib/research/bollingerCombinedStudyReader";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=30;
const headers={"Cache-Control":"private, no-store"};
export async function GET(){
 const {isOwner}=await getLearningOwnerSession();
 if(!isOwner)return NextResponse.json({success:false,error:"OWNER_ONLY"},
  {status:403,headers});
 try{
  const report=await getCombinedBollingerStudy();
  return NextResponse.json({success:true,report},{headers});
 }catch(e){
  console.error("BB combined research unavailable",e instanceof Error?e.name:"ERROR");
  return NextResponse.json({success:false,error:"RESEARCH_SOURCE_UNAVAILABLE"},
   {status:503,headers});
 }
}
