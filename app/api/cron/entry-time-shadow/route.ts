import {NextResponse} from "next/server";
import {runEntryTimeShadowDaily} from "@/app/lib/research/entryTimeShadowRunner";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
export async function GET(request:Request){
  const secret=process.env.CRON_SECRET;
  if(!secret||request.headers.get("authorization")!=="Bearer "+secret)
    return NextResponse.json({success:false,error:"Unauthorized"},{status:401});
  try {
    const result=await runEntryTimeShadowDaily();
    return NextResponse.json(result,{status:result.success?200:503,
      headers:{"Cache-Control":"private, no-store"}});
  }catch(error){
    console.error("entry-time shadow cron failed",error);
    return NextResponse.json({success:false,error:"ENTRY_TIME_SHADOW_UNAVAILABLE"},
      {status:503,headers:{"Cache-Control":"private, no-store"}});
  }
}
