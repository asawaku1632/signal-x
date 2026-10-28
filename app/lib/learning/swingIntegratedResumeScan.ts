import pool from "@/app/lib/postgres";
import {auditFiveDayTradingCalendar,type FiveDayAuditRow} from "@/app/lib/learning/swingFiveDayCalendarAudit";
import {decideAuditResume} from "@/app/lib/learning/swingAuditResumeGuard";
import {UNIVERSE_SWING_RULE_VERSION} from "@/app/lib/learning/swingUniverseAudit";
// Test-only orchestrator for an existing disposable database fixture.
// Single repeatable-read transaction: no modifications or persisted approvals.
type Checkpoint={auditId:string;ruleVersion:string;fingerprint:string;eligible:number;inspected:number;cursorDate:string|null;cursorCode:string|null;completed:boolean};
export async function inspectResumeAndScan(checkpoint:Checkpoint,pageSize=100,maxPages=10){
 if(!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>200||!Number.isSafeInteger(maxPages)||maxPages<1||maxPages>50)throw Error("INVALID_BOUNDS");
 const client=await pool.connect();
 try{
  await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const agg=await client.query<{eligible:number;digest:string}>(`SELECT COUNT(*) FILTER(WHERE return_5d IS NOT NULL OR outcome_5d_date IS NOT NULL)::integer eligible,
   md5(COALESCE(string_agg(trade_date::text||':'||code||':'||COALESCE(return_5d::text,'NULL')||':'||COALESCE(outcome_5d_date::text,'NULL'),'|' ORDER BY trade_date,code),'EMPTY')) digest
   FROM public.swing_universe_observations WHERE rule_version=$1`,[UNIVERSE_SWING_RULE_VERSION]);
  const a=agg.rows[0];
  const guard=decideAuditResume({auditId:checkpoint.auditId,ruleVersion:UNIVERSE_SWING_RULE_VERSION,storedRuleVersion:checkpoint.ruleVersion,
   storedFingerprint:checkpoint.fingerprint,currentFingerprint:a.digest,eligibleAtStart:checkpoint.eligible,eligibleNow:a.eligible,
   inspected:checkpoint.inspected,cursorDate:checkpoint.cursorDate,cursorCode:checkpoint.cursorCode,completed:checkpoint.completed});
  if(guard.action!=="RESUME"){await client.query("COMMIT");return {action:"STOP" as const,reasons:guard.reasons,scanned:0,issues:[],completed:false,productionApplied:false as const};}
  let cursorDate=checkpoint.cursorDate,cursorCode=checkpoint.cursorCode,scanned=0;
  const issues:ReturnType<typeof auditFiveDayTradingCalendar>["issues"]=[];
  for(let page=0;page<maxPages;page++){
   const r:{rows:FiveDayAuditRow[]}=await client.query<FiveDayAuditRow>(`SELECT trade_date::text,code,return_5d::text,outcome_5d_date::text FROM public.swing_universe_observations
    WHERE rule_version=$1 AND (return_5d IS NOT NULL OR outcome_5d_date IS NOT NULL)
    AND ($2::date IS NULL OR trade_date<$2::date OR (trade_date=$2::date AND code>$3::text))
    ORDER BY trade_date DESC,code ASC LIMIT $4`,[UNIVERSE_SWING_RULE_VERSION,cursorDate,cursorCode,pageSize]);
   if(!r.rows.length)break;
   scanned+=r.rows.length;issues.push(...auditFiveDayTradingCalendar(r.rows,pageSize).issues);
   const last:FiveDayAuditRow=r.rows[r.rows.length-1];cursorDate=last.trade_date;cursorCode=last.code;
   if(scanned+checkpoint.inspected>=a.eligible)break;
  }
  if(scanned+checkpoint.inspected>a.eligible)throw Error("SCAN_COUNT_OVERRUN");
  await client.query("COMMIT");
  return {action:"RESUME" as const,reasons:[],scanned,issues,completed:scanned+checkpoint.inspected===a.eligible,
   remaining:a.eligible-scanned-checkpoint.inspected,cursorDate,cursorCode,
   productionApplied:false as const,notificationEnabled:false as const,adoptionApproved:false as const};
 }catch(error){await client.query("ROLLBACK");throw error}finally{client.release()}
}
