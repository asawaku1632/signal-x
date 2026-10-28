import pool from "@/app/lib/postgres";
import {UNIVERSE_SWING_RULE_VERSION} from "@/app/lib/learning/swingUniverseAudit";
// Real stored observations only. Audit consistency, NOT provenance/license.
// Parameterized read-only SQL; no historic row changes.
export async function readSwingObservationIntegrity(){
 const result=await pool.query<{
 total:string;evaluated:string;missing_outcome_date:string;
 outcome_without_return:string;non_future_outcome:string;
 bad_entry_price:string;invalid_return:string;
 distinct_days:string;earliest_day:string|null;latest_day:string|null;
 }>(`SELECT COUNT(*)::text AS total,
 COUNT(return_5d)::text AS evaluated,
 COUNT(*) FILTER (WHERE return_5d IS NOT NULL AND outcome_5d_date IS NULL)::text AS missing_outcome_date,
 COUNT(*) FILTER (WHERE return_5d IS NULL AND outcome_5d_date IS NOT NULL)::text AS outcome_without_return,
 COUNT(*) FILTER (WHERE outcome_5d_date IS NOT NULL AND outcome_5d_date <= trade_date)::text AS non_future_outcome,
 COUNT(*) FILTER (WHERE entry_price IS NULL OR entry_price <= 0)::text AS bad_entry_price,
 COUNT(*) FILTER (WHERE return_5d IS NOT NULL AND (return_5d < -100 OR return_5d > 10000))::text AS invalid_return,
 COUNT(DISTINCT trade_date)::text AS distinct_days,
 MIN(trade_date)::text AS earliest_day,
 MAX(trade_date)::text AS latest_day
 FROM public.swing_universe_observations WHERE rule_version=$1`,[UNIVERSE_SWING_RULE_VERSION]);
 const row=result.rows[0];
 const metrics={
  total:Number(row?.total??0),evaluated:Number(row?.evaluated??0),
  missingOutcomeDate:Number(row?.missing_outcome_date??0),
  outcomeWithoutReturn:Number(row?.outcome_without_return??0),
  nonFutureOutcome:Number(row?.non_future_outcome??0),
  badEntryPrice:Number(row?.bad_entry_price??0),
  invalidReturn:Number(row?.invalid_return??0),
  distinctDays:Number(row?.distinct_days??0),
  earliestDay:row?.earliest_day??null,latestDay:row?.latest_day??null
 };
 const issues:string[]=[];
 if(Object.values(metrics).slice(0,9).some(v=>typeof v!=="number"||!Number.isSafeInteger(v)||v<0))issues.push("INVALID_AGGREGATION");
 if(metrics.evaluated>metrics.total)issues.push("EVALUATED_EXCEEDS_TOTAL");
 if(metrics.missingOutcomeDate)issues.push("RETURN_WITHOUT_TARGET_DATE");
 if(metrics.outcomeWithoutReturn)issues.push("TARGET_DATE_WITHOUT_RETURN");
 if(metrics.nonFutureOutcome)issues.push("TARGET_DATE_NOT_AFTER_SIGNAL");
 if(metrics.badEntryPrice)issues.push("INVALID_ENTRY_PRICE");
 if(metrics.invalidReturn)issues.push("OUT_OF_RANGE_RETURN");
 return {scope:UNIVERSE_SWING_RULE_VERSION,metrics,issues,
   // Data integrity alone cannot certify independent source, licensing or actual returns.
   sourceVerified:false as const,licenseVerified:false as const,
   independentTimeVerified:false as const,adoptionApproved:false as const,
   productionApplied:false as const};
}
