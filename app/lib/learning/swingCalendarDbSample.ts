import pool from "@/app/lib/postgres";
import {auditFiveDayTradingCalendar,type FiveDayAuditRow} from "@/app/lib/learning/swingFiveDayCalendarAudit";
import {UNIVERSE_SWING_RULE_VERSION} from "@/app/lib/learning/swingUniverseAudit";
// Owner-only caller; bounded, read-only, not exhaustive. No approval or trading impact.
export async function readSwingFiveDayCalendarSample(limit=100){
 if(!Number.isSafeInteger(limit)||limit<1||limit>100)throw new Error("INVALID_CALENDAR_SAMPLE_LIMIT");
 const result=await pool.query<{trade_date:string;code:string;return_5d:string|null;outcome_5d_date:string|null}>(`
 SELECT trade_date::text,code,return_5d::text,outcome_5d_date::text
 FROM public.swing_universe_observations
 WHERE rule_version=$1 AND (return_5d IS NOT NULL OR outcome_5d_date IS NOT NULL)
 ORDER BY trade_date DESC,code ASC LIMIT $2`,[UNIVERSE_SWING_RULE_VERSION,limit]);
 const totals=await pool.query<{total:string;eligible:string}>(`
 SELECT COUNT(*)::text AS total,
 COUNT(*) FILTER(WHERE return_5d IS NOT NULL OR outcome_5d_date IS NOT NULL)::text AS eligible
 FROM public.swing_universe_observations WHERE rule_version=$1`,[UNIVERSE_SWING_RULE_VERSION]);
 const total=Number(totals.rows[0]?.total??NaN),eligible=Number(totals.rows[0]?.eligible??NaN);
 if(!Number.isSafeInteger(total)||!Number.isSafeInteger(eligible)||total<eligible||eligible<0)throw Error("INVALID_COVERAGE_COUNTS");
 const rows:FiveDayAuditRow[]=result.rows.map(r=>({trade_date:r.trade_date,code:r.code,return_5d:r.return_5d,outcome_5d_date:r.outcome_5d_date}));
 const audited=auditFiveDayTradingCalendar(rows,limit);
 const uninspected=eligible-rows.length;
 const calendarUnavailable=audited.issues.filter(x=>x.reason==='MARKET_CALENDAR_UNAVAILABLE').length;
 return {...audited,totalObservations:total,eligibleObservations:eligible,notYetEvaluated:total-eligible,uninspectedEligible:uninspected,calendarUnavailableInSample:calendarUnavailable,coveragePercent:eligible?Math.round(rows.length/eligible*10000)/100:0,requestedLimit:limit,limitReached:uninspected>0,
  source:"READ_ONLY_FROZEN_SWING_SAMPLE" as const,productionApplied:false as const};
}
