import {NextResponse} from "next/server";
import {runForwardProspectiveDay} from "@/app/lib/research/bollingerForwardRunner";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=180;
// Dedicated research-only cron, NOT part of buy/sell, BB production learning,
// runner notifications, or real customer alerts.
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret||request.headers.get("authorization")!=="Bearer "+secret)
  return NextResponse.json({success:false,error:"UNAUTHORIZED"},{status:401});
 try{
  const result=await runForwardProspectiveDay();
  return NextResponse.json(result,{
   status:result.success?200:503,
   headers:{"Cache-Control":"private, no-store"}
  });
 }catch(error){
  console.error("BB forward research failed",error instanceof Error?error.name:"UNKNOWN");
  return NextResponse.json({success:false,error:"FORWARD_RESEARCH_UNAVAILABLE"},
   {status:503,headers:{"Cache-Control":"private, no-store"}});
 }
}
