import {NextResponse} from "next/server";
import {createHash} from "node:crypto";
import pool from "@/app/lib/postgres";
import {getLearningOwnerSession} from "@/app/lib/learningOwner";
import {fetchNecklineStableCohort} from "@/app/lib/research/shadowCandleYahoo";

export const dynamic="force-dynamic";
export const runtime="nodejs";
export const maxDuration=60;

export async function POST(request:Request){
  const {isOwner}=await getLearningOwnerSession();
  if(!isOwner)return NextResponse.json({success:false,error:"Unauthorized"},{status:403});
  try{
    const form=await request.formData();
    const raw=form.get("codes");
    if(typeof raw!=="string"||raw.length>120){
      return NextResponse.json({success:false,error:"INVALID_CODES"},{status:400});
    }
    const codes=raw.trim().split(/[\s,、]+/).filter(Boolean);
    if(codes.length<1||codes.length>15||new Set(codes).size!==codes.length
      ||codes.some(code=>!/^[0-9]{4}$/.test(code))){
      return NextResponse.json({success:false,error:"INVALID_CODES"},{status:400});
    }
    // The user explicitly requests this historical replay snapshot.
    // Its immutable archival time is NOT the signal time of a forward study.
    const cohort=await fetchNecklineStableCohort(codes);
    const payload=JSON.stringify(cohort);
    const digest=createHash("sha256").update(payload).digest("hex");
    const result=await pool.query<{id:string}>(`
      INSERT INTO public.neckline_replay_snapshots
        (policy_version,requested_codes,cohort,cohort_sha256)
      VALUES ('NECKLINE_MANUAL_SNAPSHOT_V1',$1::text[],$2::jsonb,$3)
      RETURNING id::text
    `,[codes,payload,digest]);
    const id=result.rows[0]?.id;
    if(!id)throw Error("SNAPSHOT_NOT_ARCHIVED");
    const location=new URL("/admin/neckline-entry-risk",request.url);
    location.searchParams.set("snapshot",id);
    return NextResponse.redirect(location,{status:303});
  }catch(error){
    console.error("[neckline-replay-snapshot] owner archive unavailable",error);
    return NextResponse.json({success:false,error:"RESEARCH_SNAPSHOT_UNAVAILABLE"},{status:503});
  }
}
