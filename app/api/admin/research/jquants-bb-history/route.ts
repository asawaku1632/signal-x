import { NextResponse } from "next/server";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import { fetchBbResearchJquantsBars } from "@/app/lib/research/dailyForwardBbJquantsResearchFetcher.mjs";
import { summarizeBbJquantsComparisons } from "@/app/lib/research/dailyForwardBbJquantsBatchAudit.mjs";
import { observations } from "@/app/lib/research/bbJquantsPinnedObservations.mjs";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = {"Cache-Control":"private, no-store"};
const fail=(reason:string,status=403)=>NextResponse.json({success:false,reason},{status,headers});
const branch="research/morning-quote-metadata-diagnostics-20261026";
const snapshot="PINNED_DEV_SNAPSHOT_2026_10_27";
function allowed() {
 return process.env.VERCEL_ENV==="preview" &&
 process.env.VERCEL_GIT_COMMIT_REF===branch &&
 process.env.JQUANTS_RESEARCH_PROBE_ENABLED==="true";
}
function devDb() {
 try {
  const url=new URL(process.env.MARKET_INDEX_RESEARCH_DEV_DATABASE_URL??"");
  return url.hostname==="db.jdtqwryiyxeuoraecorw.supabase.co" ||
    (url.hostname.endsWith(".pooler.supabase.com") && url.username.includes("jdtqwryiyxeuoraecorw"));
 } catch {return false;}
}
async function researchQuery(sql:string, params:unknown[] = []) {
 const pool = new Pool({connectionString:process.env.MARKET_INDEX_RESEARCH_DEV_DATABASE_URL,ssl:{rejectUnauthorized:false},max:1,connectionTimeoutMillis:8000});
 try{return await pool.query(sql,params);}finally{await pool.end();}
}
export async function GET() {
 if (!(await getLearningOwnerSession()).isOwner) return fail("OWNER_ONLY");
 if (!allowed()) return fail("RESEARCH_PREVIEW_ONLY");
 if (!devDb()) return fail("DEV_DATABASE_NOT_VERIFIED",503);
 try {
  const result=await researchQuery(`select id,checked_at,snapshot_key,total_count,matched_count,differed_count,blocked_count,unique_pairs
   from public.bb_jquants_research_audit_history order by checked_at desc,id desc limit 30`);
  const rows=result.rows as {snapshot_key:string;total_count:number;matched_count:number;differed_count:number;blocked_count:number;unique_pairs:number}[];
  const distinctSnapshots=new Set(rows.map(x=>x.snapshot_key)).size;
  const latest=rows[0]??null;
  const prior=rows[1]??null;
  const changed=Boolean(latest&&prior&&(latest.matched_count!==prior.matched_count||latest.differed_count!==prior.differed_count||latest.blocked_count!==prior.blocked_count));
  return NextResponse.json({success:true,history:rows,analysis:{runsInWindow:rows.length,distinctSnapshots,latest,changedSincePreviousRun:changed,independentEvidenceGrowth:distinctSnapshots>1,eligibleForProduction:false,assessment:rows.length===0?"NO_SAVED_AUDIT":distinctSnapshots===1?"REPEAT_CHECK_OF_ONE_PINNED_SNAPSHOT":"MULTIPLE_SNAPSHOTS_REQUIRE_MANUAL_REVIEW"}},{headers});
 } catch {return fail("RESEARCH_HISTORY_READ_FAILED",503);}
}
export async function POST(request:Request) {
 if (!(await getLearningOwnerSession()).isOwner) return fail("OWNER_ONLY");
 if (!allowed()) return fail("RESEARCH_PREVIEW_ONLY");
 if (!devDb()) return fail("DEV_DATABASE_NOT_VERIFIED",503);
 if(request.headers.get("content-type")?.split(";")[0].trim()!=="application/json")return fail("JSON_REQUIRED",415);
 try {
  const origin=new URL(request.headers.get("origin")??"");
  if(origin.protocol!=="https:"||origin.host!==request.headers.get("host"))return fail("SAME_ORIGIN_REQUIRED");
 } catch {return fail("SAME_ORIGIN_REQUIRED");}
 let body:unknown;
 try {body=await request.json();}catch{return fail("INVALID_BODY",400);}
 if(!body||typeof body!=="object"||Array.isArray(body)||
  (body as {confirm?:unknown}).confirm!=="SAVE_BB_JQUANTS_RESEARCH_AUDIT")return fail("EXPLICIT_SAVE_CONFIRMATION_REQUIRED",400);
 const fetched=await fetchBbResearchJquantsBars({enabled:true,apiKey:process.env.JQUANTS_API_KEY});
 if(fetched.status!=="RESEARCH_ONLY_BARS_FETCHED")return fail(fetched.reason??"FETCH_FAILED",503);
 const audit=summarizeBbJquantsComparisons(observations,fetched.barsByCode);
 const pairs=new Set(observations.map(x=>x.code+":"+x.observation_date));
 const details=audit.details.map(({code,observationDate,status,reason})=>({code,observationDate,status,reason}));
 try {
  const result=await researchQuery(`insert into public.bb_jquants_research_audit_history
   (snapshot_key,total_count,matched_count,differed_count,blocked_count,unique_pairs,reasons,details)
   values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb) returning id,checked_at`,
   [snapshot,audit.total,audit.matched,audit.differed,audit.blocked,pairs.size,
    JSON.stringify(audit.reasons),JSON.stringify(details)]);
  return NextResponse.json({success:true,saved:true,id:result.rows[0].id,
   checkedAt:result.rows[0].checked_at,total:audit.total,matched:audit.matched,
   differed:audit.differed,blocked:audit.blocked,uniquePairs:pairs.size,
   productionWrites:false,productionApproval:false},{headers});
 }catch{return fail("RESEARCH_HISTORY_SAVE_FAILED",503);}
}
