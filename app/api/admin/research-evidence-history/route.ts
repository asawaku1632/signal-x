import {NextResponse} from "next/server";
import {getLearningOwnerSession} from "@/app/lib/learningOwner";
import {readResearchEvidenceHistory} from "@/app/lib/learning/researchEvidenceHistoryRead";
export const dynamic="force-dynamic";export const runtime="nodejs";
export async function GET(request:Request){
 const owner=await getLearningOwnerSession();
 if(!owner.isOwner)return NextResponse.json({success:false,error:"Forbidden"},{status:403});
 const query=new URL(request.url).searchParams;
 try{
  const history=await readResearchEvidenceHistory(query.get("researchId")??"",query.get("ruleVersion")??"");
  return NextResponse.json({success:true,...history},{headers:{"Cache-Control":"private, no-store"}});
 }catch{return NextResponse.json({success:false,error:"証拠履歴を取得できませんでした"},{status:400});}
}
