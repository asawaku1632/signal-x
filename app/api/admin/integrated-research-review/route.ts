import {NextResponse} from "next/server";
import {getLearningOwnerSession} from "@/app/lib/learningOwner";
import {getIntegratedResearchReview} from "@/app/lib/learning/integratedResearchReview";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export async function GET(){
 const owner=await getLearningOwnerSession();
 if(!owner.isOwner)return NextResponse.json({success:false,error:"Forbidden"},{status:403,headers:{"Cache-Control":"private, no-store"}});
 try{
  const result=await getIntegratedResearchReview();
  return NextResponse.json({success:true,...result},{headers:{"Cache-Control":"private, no-store"}});
 }catch{
  return NextResponse.json({success:false,error:"研究証拠の照合に失敗しました"},{status:503,headers:{"Cache-Control":"private, no-store"}});
 }
}
