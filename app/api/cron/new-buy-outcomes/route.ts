import {NextResponse} from "next/server";
import {requireCronAuth} from "@/app/lib/cronAuth";
import {isLearningOwnerEmail} from "@/app/lib/learningOwner";
import {isTseTradingDate} from "@/app/lib/technicalObservation/tseMarketCalendar";
import {captureFreshBuyOutcomes} from "@/app/lib/freshBuyOutcomeRunner";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=300;
export async function GET(request:Request){
 const denied=requireCronAuth(request);if(denied)return denied;
 const jst=new Date(Date.now()+32400000),date=jst.toISOString().slice(0,10);
 const minute=jst.getUTCHours()*60+jst.getUTCMinutes();
 if(!isTseTradingDate(date)||minute<17*60||minute>=21*60)return NextResponse.json({success:true,skipped:"OUTSIDE_OUTCOME_WINDOW"});
 const owner=(process.env.SIGNALX_LEARNING_OWNER_EMAIL||process.env.ADMIN_EMAIL||"").trim().toLowerCase();
 if(!isLearningOwnerEmail(owner))return NextResponse.json({success:false,error:"OWNER_UNAVAILABLE"},{status:503});
 try{return NextResponse.json({success:true,date,...await captureFreshBuyOutcomes(owner,date)});}
 catch{return NextResponse.json({success:false,date,error:"FORWARD_CAPTURE_FAILED"},{status:503});}
}
