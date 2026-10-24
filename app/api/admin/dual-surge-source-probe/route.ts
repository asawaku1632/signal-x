import {NextResponse} from "next/server";
import {getLearningOwnerSession} from "@/app/lib/learningOwner";

export const dynamic="force-dynamic";
export const runtime="nodejs";
const headers={"Cache-Control":"private, no-store"};
// Read-only, owner-only diagnostic. Never returns or logs provider credentials or OHLCV.
export async function GET(){
 const {isOwner}=await getLearningOwnerSession();
 if(!isOwner)return NextResponse.json({success:false,error:"OWNER_ONLY"},{status:403,headers});
 if(process.env.VERCEL_ENV!=="preview"||process.env.JQUANTS_RESEARCH_PROBE_ENABLED!=="true")
  return NextResponse.json({success:false,error:"PROBE_DISABLED"},{status:503,headers});
 const key=process.env.JQUANTS_API_KEY;
 if(!key)return NextResponse.json({success:false,error:"API_KEY_MISSING"},{status:503,headers});
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),8000);
 try{
  // Fixed past completed trading session; no live market data or persistence.
  const response=await fetch("https://api.jquants.com/v2/equities/bars/daily?date=2026-10-23",{
   method:"GET",headers:{"x-api-key":key,"Accept":"application/json"},
   signal:controller.signal,cache:"no-store"
  });
  if(!response.ok)return NextResponse.json({success:false,error:"PROVIDER_RESPONSE",providerStatus:response.status},{status:502,headers});
  const payload=await response.json();
  const rows=Array.isArray(payload?.data)?payload.data:null;
  if(!rows)return NextResponse.json({success:false,error:"UNEXPECTED_PROVIDER_FORMAT"},{status:502,headers});
  return NextResponse.json({success:true,source:"JQUANTS_V2",sessionDate:"2026-10-23",recordsReceived:rows.length,
   sampleCodePresent:rows.some((x: Record<string, unknown>)=>typeof x?.Code==="string"||typeof x?.code==="string"),
   persisted:false,licensedForAutomatedResearch:"NOT_VERIFIED"},{headers});
 }catch{
  return NextResponse.json({success:false,error:"PROVIDER_UNAVAILABLE"},{status:502,headers});
 }finally{clearTimeout(timeout);}
}
