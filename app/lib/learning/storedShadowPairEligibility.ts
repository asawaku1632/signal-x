import pool from "@/app/lib/postgres";
import {UNIVERSE_SWING_RULE_VERSION} from "@/app/lib/learning/swingUniverseAudit";
import {auditFiveDayTradingCalendar} from "@/app/lib/learning/swingFiveDayCalendarAudit";
// Owner-authorized caller only. Stored swing observations are NOT paired baseline/shadow
// predictions. Never fabricate counterfactual returns, provenance, or market regimes.
export async function readStoredShadowPairEligibility(limit=100){
 if(!Number.isSafeInteger(limit)||limit<1||limit>100)throw Error("INVALID_STORED_PAIR_LIMIT");
 const result=await pool.query<{trade_date:string;code:string;return_5d:string|null;outcome_5d_date:string|null}>(`
 SELECT trade_date::text,code,return_5d::text,outcome_5d_date::text
 FROM public.swing_universe_observations
 WHERE rule_version=$1 ORDER BY trade_date DESC,code ASC LIMIT $2`,
 [UNIVERSE_SWING_RULE_VERSION,limit]);
 const audit=auditFiveDayTradingCalendar(result.rows,limit);
 const calendarIssues=new Map(audit.issues.map(x=>[x.tradeDate+":"+x.code,x.reason]));
 const observations=result.rows.map(r=>{
  const reason=calendarIssues.get(r.trade_date+":"+r.code);
  const outcomePresent=r.return_5d!==null&&r.outcome_5d_date!==null;
  const numericOutcome=outcomePresent&&Number.isFinite(Number(r.return_5d));
  const reasons=[...(reason?["CALENDAR_"+reason]:[]),...(!outcomePresent?["OUTCOME_NOT_COMPLETE"]:[]),
   ...(!numericOutcome&&outcomePresent?["INVALID_OUTCOME"]:[]),
   "NO_INDEPENDENT_BASELINE_SHADOW_PAIR","NO_INDEPENDENT_REGIME_PROVENANCE"];
  return {tradeDate:r.trade_date,code:r.code,outcomePresent,
   fiveDayReturn:numericOutcome?Number(r.return_5d):null,reasons,
   pairEligible:false as const};
 });
 return {observations,inspected:observations.length,calendarIssues:audit.issues.length,
  blocked:observations.length,eligiblePairs:0 as const,limit,
  exhaustive:false as const,independentPairVerified:false as const,
  ownerReviewOnly:true as const,productionApplied:false as const,notificationEnabled:false as const};
}
