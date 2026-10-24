import {NextResponse} from "next/server";
import {getLearningOwnerSession} from "@/app/lib/learningOwner";
// Research-only JS detector is intentionally independent of production TS analysis.
// @ts-ignore Research-only .mjs module has no generated declaration.
import {inspectDualSurge} from "@/app/lib/research/dualSurgeDetectors.mjs";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
const codes=["3762","3996","9684"] as const;
const endDate="2026-10-23";
const fromDate="2026-09-01";
type ProviderRow={Code?:unknown;Date?:unknown;O?:unknown;H?:unknown;L?:unknown;C?:unknown;Vo?:unknown;AdjFactor?:unknown};
type Candle={time:number;open:number;high:number;low:number;close:number;volume:number};
const positive=(v:unknown):v is number=>typeof v==="number"&&Number.isFinite(v)&&v>0;
function convert(row:ProviderRow,code:string):{date:string;bar:Candle;split:boolean}|null{
 if(typeof row.Code!=="string"||!row.Code.startsWith(code)||typeof row.Date!=="string"||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(row.Date))return null;
 const {O,H,L,C,Vo}=row;
 if(!positive(O)||!positive(H)||!positive(L)||!positive(C)||typeof Vo!=="number"||!Number.isFinite(Vo)||Vo<0)return null;
 if(H<Math.max(O,C,L)||L>Math.min(O,C))return null;
 const t=Date.parse(row.Date+"T15:00:00+09:00")/1000;
 if(!Number.isSafeInteger(t))return null;
 return {date:row.Date,bar:{time:t,open:O,high:H,low:L,close:C,volume:Vo},split:typeof row.AdjFactor==="number"&&row.AdjFactor!==1};
}
async function load(code:string,key:string,signal:AbortSignal){
 const all:ProviderRow[]=[];
 let cursor:string|undefined;
 for(let page=0;page<5;page++){
  const url=new URL("https://api.jquants.com/v2/equities/bars/daily");
  url.searchParams.set("code",code);
  url.searchParams.set("from",fromDate);
  url.searchParams.set("to",endDate);
  if(cursor)url.searchParams.set("pagination_key",cursor);
  const response=await fetch(url,{headers:{"x-api-key":key,Accept:"application/json"},signal,cache:"no-store"});
  if(!response.ok)throw Error("PROVIDER_HTTP_"+response.status);
  const payload:unknown=await response.json();
  if(!payload||typeof payload!=="object"||!("data" in payload)||!Array.isArray(payload.data))throw Error("PROVIDER_FORMAT");
  all.push(...payload.data as ProviderRow[]);
  const next="pagination_key" in payload?payload.pagination_key:undefined;
  if(typeof next!=="string"||!next)return all;
  cursor=next;
 }
 throw Error("PAGINATION_INCOMPLETE");
}
export async function GET(){
 const {isOwner}=await getLearningOwnerSession();
 if(!isOwner)return NextResponse.json({success:false,error:"OWNER_ONLY"},{status:403,headers});
 if(process.env.VERCEL_ENV!=="preview"||process.env.JQUANTS_RESEARCH_PROBE_ENABLED!=="true")
  return NextResponse.json({success:false,error:"PROBE_DISABLED"},{status:503,headers});
 const key=process.env.JQUANTS_API_KEY;
 if(!key)return NextResponse.json({success:false,error:"API_KEY_MISSING"},{status:503,headers});
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),25000);
 try{
  const results=[];
  for(const code of codes){
   const raw=await load(code,key,controller.signal);
   const valid=raw.map(r=>convert(r,code)).filter((x):x is NonNullable<typeof x>=>x!==null).sort((a,b)=>a.date.localeCompare(b.date));
   const unique=valid.filter((x,i)=>i===0||x.date!==valid[i-1].date);
   const window=unique.slice(-22);
   const complete=window.length===22&&window.at(-1)?.date===endDate;
   const split=window.some(x=>x.split);
   const evaluated=complete&&!split?inspectDualSurge(window.map(x=>x.bar)):null;
   results.push({code,recordsReceived:raw.length,validOHLCV:valid.length,invalidOrMissingOHLCV:raw.length-valid.length,
    latestDate:unique.at(-1)?.date||null,has22CompletedSessions:complete,corporateActionInWindow:split,
    detectorAvailable:evaluated?.available===true,detectorReason:evaluated?.available===true?null:(evaluated?.reason||(!complete?"INSUFFICIENT_FRESH_HISTORY":split?"CORPORATE_ACTION_UNADJUSTED":"UNAVAILABLE")),
    cohorts:evaluated?.available===true?evaluated.signals.map((s:{cohort:string})=>s.cohort):[]});
  }
  return NextResponse.json({success:true,source:"JQUANTS_V2",mode:"READ_ONLY_HISTORICAL_DIAGNOSTIC",fromDate,endDate,
   codesChecked:codes.length,results,persisted:false,licenseForAutomatedResearch:"NOT_VERIFIED",
   note:"Historical detector checks are NOT prospective saved signals."},{headers});
 }catch(e){
  const reason=e instanceof Error&&/^PROVIDER_HTTP_[0-9]{3}$/.test(e.message)?e.message:"PROBE_UNAVAILABLE";
  return NextResponse.json({success:false,error:reason,persisted:false},{status:502,headers});
 }finally{clearTimeout(timeout);}
}
