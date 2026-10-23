import { NextResponse } from "next/server";
import { getLearningOwnerSession } from "@/app/lib/learningOwner";
import { Pool } from "pg";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Owner-only, read-only. Never returns source OHLCV or provider secrets.
export async function GET() {
 const { isOwner } = await getLearningOwnerSession();
 if (!isOwner) return NextResponse.json({success:false,error:"Owner access required"},{status:403,headers:{"Cache-Control":"private, no-store"}});
 if (process.env.VERCEL_ENV !== "preview" || process.env.DUAL_SURGE_SHADOW_READ_ENABLED !== "true")
  return NextResponse.json({success:false,error:"RESEARCH_DISABLED"},{status:503,headers:{"Cache-Control":"private, no-store"}});
 // Never reuse the application's DATABASE_URL for this isolated research.
 // A separate dev-only URL and project reference must both be configured.
 const devUrl=process.env.DUAL_SURGE_DEV_DATABASE_URL;
 if (!devUrl || process.env.DUAL_SURGE_DEV_PROJECT_REF !== "jdtqwryiyxeuoraecorw")
  return NextResponse.json({success:false,error:"RESEARCH_UNAVAILABLE"},{status:503,headers:{"Cache-Control":"private, no-store"}});
 // Reject a mismatched database endpoint even if the project-ref flag was copied.
 try {
  const url=new URL(devUrl);
  const ref="jdtqwryiyxeuoraecorw";
  const direct=url.hostname===`db.${ref}.supabase.co`;
  const pooler=url.hostname.endsWith(".pooler.supabase.com") && decodeURIComponent(url.username).endsWith(`.${ref}`);
  if (!["postgres:","postgresql:"].includes(url.protocol) || (!direct && !pooler)) throw Error("WRONG_DEV_DATABASE");
 } catch {
  return NextResponse.json({success:false,error:"RESEARCH_UNAVAILABLE"},{status:503,headers:{"Cache-Control":"private, no-store"}});
 }
 const pool=new Pool({connectionString:devUrl,ssl:{rejectUnauthorized:true},max:2,connectionTimeoutMillis:3000});
 try {
  const summary=await pool.query(
   "select cohort,count(*)::integer as candidates,count(distinct code)::integer as codes,min(signal_date)::text as first_date,max(signal_date)::text as last_date from public.dual_surge_shadow_candidates group by cohort order by cohort"
  );
  const outcomes=await pool.query(
   "select c.cohort,o.horizon,count(*)::integer as completed,round(avg(o.return_percent),4)::text as mean_return_percent from public.dual_surge_shadow_outcomes o join public.dual_surge_shadow_candidates c on c.id=o.candidate_id where o.status='COMPLETE' group by c.cohort,o.horizon order by c.cohort,o.horizon"
  );
  return NextResponse.json({success:true,prospectiveOnly:true,summary:summary.rows,outcomes:outcomes.rows},{headers:{"Cache-Control":"private, no-store"}});
 } catch(e) {
  console.error("[dual-surge] owner summary unavailable",e);
  return NextResponse.json({success:false,error:"RESEARCH_UNAVAILABLE"},{status:503,headers:{"Cache-Control":"private, no-store"}});
 } finally {
  await pool.end();
 }
}
