import { NextResponse } from "next/server";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import { getSwingResearchReviewSnapshot } from "@/app/lib/learning/swingResearchReviewSnapshot";

export const dynamic="force-dynamic";
export const runtime="nodejs";
export async function GET(){
  const owner=await getLearningOwnerSession();
  if(!owner.isOwner) return NextResponse.json({success:false,error:"Forbidden"},{status:403});
  try{
    const snapshot=await getSwingResearchReviewSnapshot();
    return NextResponse.json({success:true,...snapshot},{headers:{"Cache-Control":"private, no-store"}});
  }catch(error){
    console.error("[research-review-snapshot] read failed",error);
    return NextResponse.json({success:false,error:"研究データを取得できませんでした"},{status:500});
  }
}
