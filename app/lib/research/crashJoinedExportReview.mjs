import {auditCrashCategoryOutcomes} from "./crashCategoryOutcomes.mjs";
import {summarizeCrashByEvent} from "./crashEventSummary.mjs";
/** Offline, read-only shaped export reconciliation; OBSERVED is not independent provenance. */
export function reviewCrashJoinedExport(rows){
 if(!Array.isArray(rows)||rows.length>10000)throw Error("INVALID_JOINED_CRASH_EXPORT");
 const accepted=[],errors={invalid:0,missingOutcome:0,chronology:0,duplicates:0},seen=new Set();
 const date=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+"T00:00:00Z"))&&new Date(x+"T00:00:00Z").toISOString().slice(0,10)===x;
 const parsed=x=>Date.parse(typeof x==="string"?x.replace(/([+-]\d{2})$/,"$1:00"):x);
 const stamp=x=>typeof x==="string"&&Number.isFinite(parsed(x))&&/^(\d{4}-\d\d-\d\d)[ T]\d\d:\d\d:\d\d/.test(x)&&/(Z|[+-]\d\d(?::?\d\d))$/.test(x);
 for(const r of rows){
  if(!r||!date(r.event_date)||typeof r.code!=="string"||!["REBOUND_WATCH","RESISTANCE"].includes(r.category)){errors.invalid++;continue;}
  const key=r.event_date+"|"+r.code;
  if(seen.has(key)){errors.duplicates++;continue;}seen.add(key);
  if(r.status!=="OBSERVED"||!date(r.outcome_date)||!Number.isFinite(Number(r.excess_return))||r.excess_return==null){errors.missingOutcome++;continue;}
  if(r.outcome_date<=r.event_date||!stamp(r.selected_at)||!stamp(r.evaluated_at)||
    parsed(r.selected_at)>=Date.parse(r.outcome_date+"T00:00:00+09:00")||
    parsed(r.evaluated_at)<Date.parse(r.outcome_date+"T00:00:00+09:00")||
    Date.parse(r.evaluated_at)<=Date.parse(r.selected_at)){errors.chronology++;continue;}
  accepted.push({eventDate:r.event_date,code:r.code,category:r.category,excessReturn:Number(r.excess_return)});
 }
 const category=auditCrashCategoryOutcomes(accepted),event=summarizeCrashByEvent(accepted);
 return {inputRows:rows.length,acceptedRows:accepted.length,errors,category,event,
  evidenceQuality:"POST_CLOSE_RETROSPECTIVE_ONLY",independentlyVerified:false,
  notificationsEnabled:false,trainingEnabled:false,tradingEnabled:false};
}
