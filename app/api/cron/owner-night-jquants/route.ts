import {NextResponse} from "next/server";
import {requireCronAuth} from "@/app/lib/cronAuth";
import {isLearningOwnerEmail} from "@/app/lib/learningOwner";
import {isTseTradingDate} from "@/app/lib/technicalObservation/tseMarketCalendar";
import {captureJquantsNight,notifyJquantsNight} from "@/app/lib/jquantsNightRunner";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=300;
export async function GET(request:Request){
  const denied=requireCronAuth(request);
  if(denied)return denied;
  const now=new Date();
  const jst=new Date(now.getTime()+9*3600000);
  const date=jst.toISOString().slice(0,10);
  const minutes=jst.getUTCHours()*60+jst.getUTCMinutes();
  if(!isTseTradingDate(date)||minutes<17*60||minutes>=20*60)
    return NextResponse.json({success:true,skipped:"OUTSIDE_NIGHT_WINDOW"});
  const owner=(process.env.SIGNALX_LEARNING_OWNER_EMAIL||process.env.ADMIN_EMAIL||"").trim().toLowerCase();
  if(!isLearningOwnerEmail(owner))return NextResponse.json({success:false,error:"OWNER_UNAVAILABLE"},{status:503});
  const phase=new URL(request.url).searchParams.get("phase");
  if(phase!=="capture"&&phase!=="notify")return NextResponse.json({success:false,error:"INVALID_PHASE"},{status:400});
  try{
    if(phase==="capture"){
      await captureJquantsNight(owner,date);
      return NextResponse.json({success:true,date,phase});
    }
    if(minutes<19*60+45)return NextResponse.json({success:true,skipped:"BEFORE_NOTIFICATION_WINDOW"});
    const result=await notifyJquantsNight(owner,date);
    return NextResponse.json({success:true,date,phase,...result});
  }catch(error){
    console.error("J-Quants night analysis failed",error instanceof Error?error.message:"NIGHT_FAILED");
    return NextResponse.json({success:false,date,error:"JQUANTS_NIGHT_NOT_READY"},{status:503});
  }
}
