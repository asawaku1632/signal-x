import pool from "@/app/lib/postgres";
import {auditFiveDayTradingCalendar} from "@/app/lib/learning/swingFiveDayCalendarAudit";
import {UNIVERSE_SWING_RULE_VERSION} from "@/app/lib/learning/swingUniverseAudit";
// Owner caller only. Repeatable-read snapshot prevents page drift, transaction is read-only.
// Bounded run: exceeding budget yields incomplete, NEVER a complete attestation.
export async function inspectAllSwingCalendarRows(maxRows=10000,pageSize=250){
 if(!Number.isSafeInteger(maxRows)||maxRows<1||maxRows>100000||!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>500)throw Error("INVALID_AUDIT_BUDGET");
 const client=await pool.connect();
 try{
  await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const counts=await client.query<{eligible:string}>(`SELECT COUNT(*)::text AS eligible FROM public.swing_universe_observations
 WHERE rule_version=$1 AND (return_5d IS NOT NULL OR outcome_5d_date IS NOT NULL)`,[UNIVERSE_SWING_RULE_VERSION]);
  const eligible=Number(counts.rows[0]?.eligible);
  if(!Number.isSafeInteger(eligible)||eligible<0)throw Error("INVALID_ELIGIBLE_COUNT");
  let offset=0,issues:{code:string;tradeDate:string;reason:string}[]=[];
  while(offset<eligible && offset<maxRows){
   const take=Math.min(pageSize,maxRows-offset);
   const page=await client.query<{trade_date:string;code:string;return_5d:string|null;outcome_5d_date:string|null}>(`SELECT trade_date::text,code,return_5d::text,outcome_5d_date::text
 FROM public.swing_universe_observations WHERE rule_version=$1
 AND (return_5d IS NOT NULL OR outcome_5d_date IS NOT NULL)
 ORDER BY trade_date ASC,code ASC LIMIT $2 OFFSET $3`,[UNIVERSE_SWING_RULE_VERSION,take,offset]);
   if(page.rows.length===0)throw Error("UNEXPECTED_EMPTY_PAGE");
   const result=auditFiveDayTradingCalendar(page.rows,take);
   issues.push(...result.issues.map(x=>({code:x.code,tradeDate:x.tradeDate,reason:x.reason})));
   offset+=page.rows.length;
  }
  await client.query("COMMIT");
  return {eligible,inspected:offset,uninspected:eligible-offset,
   complete:offset===eligible,issues,issueCount:issues.length,
   provenanceVerified:false as const,approvalGranted:false as const,
   productionApplied:false as const,notificationEnabled:false as const};
 }catch(error){await client.query("ROLLBACK");throw error}
 finally{client.release()}
}
