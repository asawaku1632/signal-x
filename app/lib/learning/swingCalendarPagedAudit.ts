import pool from "@/app/lib/postgres";
import {auditFiveDayTradingCalendar,type FiveDayAuditRow} from "@/app/lib/learning/swingFiveDayCalendarAudit";
import {UNIVERSE_SWING_RULE_VERSION} from "@/app/lib/learning/swingUniverseAudit";
// Owner-only caller. Read-only repeatable-read transaction provides one consistent DB snapshot.
// Bounded work; never infer exhaustive verification from a partial scan.
export async function auditSwingFiveDayCalendarPages(pageSize=100,maxPages=10){
 if(!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>200||!Number.isSafeInteger(maxPages)||maxPages<1||maxPages>50)
  throw Error("INVALID_AUDIT_BOUNDS");
 const client=await pool.connect();
 try{
  await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const counts=await client.query<{eligible:string}>(`SELECT COUNT(*)::text AS eligible FROM public.swing_universe_observations
   WHERE rule_version=$1 AND (return_5d IS NOT NULL OR outcome_5d_date IS NOT NULL)`,[UNIVERSE_SWING_RULE_VERSION]);
  const eligible=Number(counts.rows[0]?.eligible);
  if(!Number.isSafeInteger(eligible)||eligible<0)throw Error("INVALID_ELIGIBLE_COUNT");
  let cursorDate:string|null=null,cursorCode:string|null=null,inspected=0,calendarUnavailable=0;
  const issues:ReturnType<typeof auditFiveDayTradingCalendar>["issues"]=[];
  for(let page=0;page<maxPages;page++){
   const result: {rows:FiveDayAuditRow[]}=await client.query<FiveDayAuditRow>(`SELECT trade_date::text,code,return_5d::text,outcome_5d_date::text
    FROM public.swing_universe_observations
    WHERE rule_version=$1 AND (return_5d IS NOT NULL OR outcome_5d_date IS NOT NULL)
    AND ($2::date IS NULL OR trade_date < $2::date OR (trade_date = $2::date AND code > $3::text))
    ORDER BY trade_date DESC,code ASC LIMIT $4`,[UNIVERSE_SWING_RULE_VERSION,cursorDate,cursorCode,pageSize]);
   if(!result.rows.length)break;
   const audit=auditFiveDayTradingCalendar(result.rows,pageSize);
   inspected+=audit.inspected;
   issues.push(...audit.issues);
   calendarUnavailable+=audit.issues.filter(x=>x.reason==="MARKET_CALENDAR_UNAVAILABLE").length;
   const last:FiveDayAuditRow=result.rows[result.rows.length-1];
   cursorDate=last.trade_date;cursorCode=last.code;
   if(inspected>=eligible)break;
  }
  if(inspected>eligible)throw Error("INCONSISTENT_AUDIT_TOTALS");
  await client.query("COMMIT");
  return {eligible,inspected,uninspected:eligible-inspected,calendarUnavailable,issues,
   pagesMayBeIncomplete:inspected<eligible,scanExhausted:inspected===eligible,
   // An exhaustive scan does not prove price provenance, licensing or accuracy.
   independentlyVerified:false as const,approvalRecorded:false as const,
   productionApplied:false as const,notificationEnabled:false as const};
 }catch(error){await client.query("ROLLBACK");throw error}finally{client.release()}
}
