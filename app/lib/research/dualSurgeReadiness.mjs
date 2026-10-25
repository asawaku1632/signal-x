// Read-only readiness gate for prospective dual-surge research.
// This module never fetches market data or writes observations.
export function assessDualSurgeSourceReadiness({
 provider,licenseStatus,sourceVerified,completedDate,signalDate,
 calendarVersion,candles,code
}={}) {
 const reasons=[];
 if (!/^\d{4}$/.test(code||"")) reasons.push("INVALID_CODE");
 if (typeof provider!=="string"||!provider.trim()) reasons.push("PROVIDER_MISSING");
 if (licenseStatus!=="APPROVED") reasons.push("LICENSE_NOT_APPROVED");
 if (sourceVerified!==true) reasons.push("SOURCE_NOT_VERIFIED");
 if (!/^\d{4}-\d{2}-\d{2}$/.test(signalDate||"")||completedDate!==signalDate)
  reasons.push("SESSION_NOT_COMPLETED");
 if (typeof calendarVersion!=="string"||!calendarVersion.trim())
  reasons.push("CALENDAR_UNVERIFIED");
 if (!Array.isArray(candles)||candles.length<22) reasons.push("HISTORY_UNAVAILABLE");
 return {ready:reasons.length===0,reasons};
}


export const GATES = Object.freeze([
 {id:"581-584",keys:["providerIdentity","licenseScope","storagePermission","redistributionPermission"]},
 {id:"585-588",keys:["sourceTimestamp","exchangeSession","stalenessPolicy","missingDataPolicy"]},
 {id:"589-592",keys:["rawHash","calculationVersion","asOfCutoff","replayVerified"]},
 {id:"593-596",keys:["devDatabaseIdentity","ownerAccessVerified","rlsVerified","credentialSeparationVerified"]},
 {id:"597-600",keys:["negativeTests","ciEvidence","reviewerApproval","releaseDecision"]},
]);
export function evaluateReadiness(evidence){
 if(!evidence||typeof evidence!=="object"||Array.isArray(evidence))throw Error("INVALID_READINESS_EVIDENCE");
 const groups=GATES.map(group=>{
  const checks=group.keys.map(key=>{
   const entry=Object.hasOwn(evidence,key)?evidence[key]:null;
   const valid=entry&&typeof entry==="object"&&!Array.isArray(entry)&&entry.verified===true&&typeof entry.evidenceUrl==="string"&&/^https:\/\//.test(entry.evidenceUrl)&&typeof entry.reviewedAt==="string"&&!Number.isNaN(Date.parse(entry.reviewedAt))&&typeof entry.reviewer==="string"&&entry.reviewer.trim().length>0;
   return {key,verdict:valid?"PASS":"BLOCKED"};
  });
  return {id:group.id,verdict:checks.every(x=>x.verdict==="PASS")?"PASS":"BLOCKED",checks};
 });
 return {groups,verified:groups.every(x=>x.verdict==="PASS"),productionApproved:false,readOnly:true};
}
