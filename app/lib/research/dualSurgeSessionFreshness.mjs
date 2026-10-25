// Pure, offline session freshness validator for Dual Surge research.
// No provider calls, persistence, synthetic quote substitution or trading.
const DATE=/^\d{4}-\d{2}-\d{2}$/;
function validDate(value) {
 if(typeof value!=="string"||!DATE.test(value))return false;
 const d=new Date(value+"T00:00:00Z");
 return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;
}
export function assessSessionFreshness({
 exchangeDate,sessionDate,sourceTimestamp,asOf,
 calendarVerified=false,sessionCompleted=false,
 maximumAgeMinutes=30,missing=false,duplicate=false
}={}) {
 const reasons=[];
 if(!validDate(exchangeDate)||!validDate(sessionDate)||exchangeDate!==sessionDate)reasons.push("SESSION_DATE_MISMATCH");
 if(calendarVerified!==true)reasons.push("CALENDAR_UNVERIFIED");
 if(sessionCompleted!==true)reasons.push("SESSION_INCOMPLETE");
 if(missing===true)reasons.push("MISSING_DATA");
 if(duplicate===true)reasons.push("DUPLICATE_DATA");
 const source=typeof sourceTimestamp==="string"?Date.parse(sourceTimestamp):NaN;
 const now=typeof asOf==="string"?Date.parse(asOf):NaN;
 if(!Number.isFinite(source)||!Number.isFinite(now))reasons.push("TIMESTAMP_UNAVAILABLE");
 else {
  if(source>now)reasons.push("FUTURE_TIMESTAMP");
  if(!Number.isFinite(maximumAgeMinutes)||maximumAgeMinutes<=0)reasons.push("INVALID_FRESHNESS_LIMIT");
  else if(now-source>maximumAgeMinutes*60000)reasons.push("STALE_DATA");
  if(validDate(exchangeDate)&&new Date(source).toISOString().slice(0,10)!==exchangeDate)
   reasons.push("SOURCE_SESSION_DATE_MISMATCH");
 }
 return {available:reasons.length===0,reasons,readOnly:true,productionApproved:false};
}
