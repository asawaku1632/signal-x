import {NextResponse} from "next/server";
import {Pool} from "pg";
import {getLearningOwnerSession} from "@/app/lib/learningOwner";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=15;

const headers={"Cache-Control":"private, no-store"};
const DEV_REF="jdtqwryiyxeuoraecorw";
const BRANCH="research/bb-forward-100-daily-isolated";
const fail=(reason:string,status=503)=>NextResponse.json({success:false,reason},{status,headers});

// Isolated diagnostic: never enables the expansion runner or changes its write gate.
export async function GET(){
  if(!(await getLearningOwnerSession()).isOwner)
    return fail("OWNER_ONLY",403);
  if(process.env.VERCEL_ENV!=="preview" || process.env.VERCEL_GIT_COMMIT_REF!==BRANCH)
    return fail("RESEARCH_PREVIEW_ONLY",403);
  if(process.env.BB_EXPANSION_WRITE_ENABLED!=="false")
    return fail("WRITE_GATE_NOT_CONFIRMED",403);
  if(process.env.BB_EXPANSION_RESEARCH_PROJECT_REF!==DEV_REF)
    return fail("DEV_PROJECT_REF_MISMATCH",403);

  let parsed:URL;
  try{parsed=new URL(process.env.BB_EXPANSION_RESEARCH_DATABASE_URL??"");}
  catch{return fail("INVALID_DATABASE_URL");}
  if(!["postgres:","postgresql:"].includes(parsed.protocol) ||
     decodeURIComponent(parsed.username)!=="postgres."+DEV_REF ||
     !parsed.password ||
     !/^[a-z0-9.-]+\.pooler\.supabase\.com$/.test(parsed.hostname) ||
     !["5432","6543"].includes(parsed.port))
    return fail("RESEARCH_DATABASE_IDENTITY_MISMATCH");

  const pool=new Pool({
    connectionString:process.env.BB_EXPANSION_RESEARCH_DATABASE_URL,
    ssl:{rejectUnauthorized:true},
    max:1,
    connectionTimeoutMillis:5000,
    idleTimeoutMillis:1000,
    query_timeout:5000,
  });
  let client;
  try{
    client=await pool.connect();
    await client.query("BEGIN READ ONLY");
    const result=await client.query<{database_name:string;probe:number}>(
      "SELECT current_database() AS database_name, 1 AS probe"
    );
    await client.query("ROLLBACK");
    if(result.rows[0]?.probe!==1 || result.rows[0]?.database_name!=="postgres")
      return fail("CONNECTED_DATABASE_IDENTITY_MISMATCH");
    return NextResponse.json({success:true,result:"DEV_DATABASE_READ_ONLY_CONNECTION_OK"},{headers});
  }catch{
    if(client){try{await client.query("ROLLBACK");}catch{}}
    return fail("CONNECTION_FAILED_CHECK_CREDENTIALS");
  }finally{
    client?.release();
    await pool.end().catch(()=>{});
  }
}
