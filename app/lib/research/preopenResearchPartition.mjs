/** Pure shadow-only eligibility partition for preopen reference evidence.
 * It never turns heuristic freshness into source authentication or a trading signal.
 */
import {auditPreopenWeekendPolicy} from "./preopenWeekendPolicy.mjs";
const validDate=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x+"T00:00:00Z"))&&new Date(x+"T00:00:00Z").toISOString().slice(0,10)===x;
export function classifyPreopenResearchDates(rows,{baseAgeHours=12,weekendIndexAgeHours=72}={}){
 if(!Array.isArray(rows)||rows.length>10000)throw Error("INVALID_PREOPEN_RESEARCH_ROWS");
 const seen=new Set(),counts={total:rows.length,validAgeOnly:0,excluded:0,duplicateDate:0,invalidDate:0,captureDateMismatch:0,ageOrSourceIssue:0};
 const dates=[];
 for(const row of rows){
  if(!validDate(row?.tradeDate)){counts.invalidDate++;counts.excluded++;continue;}
  if(seen.has(row.tradeDate)){counts.duplicateDate++;counts.excluded++;continue;}seen.add(row.tradeDate);
  const audit=auditPreopenWeekendPolicy(row,{baseAgeHours,weekendIndexAgeHours});
  const capturedDate=typeof row.capturedAt==="string"&&Number.isFinite(Date.parse(row.capturedAt))?
    new Date(Date.parse(row.capturedAt)+9*3600000).toISOString().slice(0,10):null;
  if(capturedDate!==row.tradeDate){counts.captureDateMismatch++;counts.excluded++;dates.push({date:row.tradeDate,status:"EXCLUDE_CAPTURE_DATE",reasons:["CAPTURE_DATE_MISMATCH"]});continue;}
  if(!audit.eligible){counts.ageOrSourceIssue++;counts.excluded++;dates.push({date:row.tradeDate,status:"EXCLUDE_SOURCE_AGE",reasons:audit.quoteAudits.filter(x=>x.reason!=="WITHIN_DECLARED_AGE").map(x=>x.name+":"+x.reason)});continue;}
  counts.validAgeOnly++;dates.push({date:row.tradeDate,status:"AGE_SCREEN_ONLY",reasons:[]});
 }
 return {version:"PREOPEN_RESEARCH_PARTITION_V1",counts,dates,
  authenticatedForPrediction:0,approvedForSignals:0,sourceLicenseVerified:false,
  warning:"AGE_SCREEN_ONLY means no structural age/date failure. It does not establish provider authenticity, trading availability, or predictive validity."};
}
