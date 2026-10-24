// Research-only independent validation gates. No network or persistence.
export const HORIZONS=Object.freeze([1,3,5,10]);
export function validateLedger(ledger){
 if(!Array.isArray(ledger))throw Error("INVALID_LEDGER");
 const keys=new Set();
 for(const e of ledger){
  if(!e||typeof e.code!=="string"||typeof e.cohort!=="string"||typeof e.startDate!=="string"||!Number.isInteger(e.signalSessionIndex))throw Error("INVALID_EVENT");
  const key=[e.code,e.cohort,e.startDate].join("|");
  if(keys.has(key))throw Error("DUPLICATE_EVENT");
  keys.add(key);
  for(const h of HORIZONS){
   for(const metric of ["legacyCloseToClose","nextOpenToFutureClose"]){
    const o=e.outcomes?.[h]?.[metric];
    if(!o||!["MATURED","PENDING","EXCLUDED_CORPORATE_OR_UNKNOWN_ADJUSTMENT","EXCLUDED_MISSING_DATA"].includes(o.status))throw Error("INVALID_OUTCOME");
    if(o.status==="MATURED"&&(!Number.isFinite(o.returnPct)))throw Error("INVALID_MATURED_RETURN");
    if(o.status!=="MATURED"&&o.returnPct!==null)throw Error("NON_MATURED_RETURN");
   }
  }
 }
 return {valid:true,events:ledger.length};
}
export function overlapFlags(ledger,horizon=5){
 if(!HORIZONS.includes(horizon))throw Error("INVALID_HORIZON");
 const sorted=[...ledger].sort((a,b)=>a.code.localeCompare(b.code)||a.signalSessionIndex-b.signalSessionIndex);
 return sorted.map((e,i)=>{
  const previous=[...sorted.slice(0,i)].reverse().find(p=>p.code===e.code);
  return {code:e.code,cohort:e.cohort,startDate:e.startDate,
   overlappingSameStock:Boolean(previous&&e.signalSessionIndex-previous.signalSessionIndex<=horizon),
   previousStartDate:previous?.startDate??null};
 });
}
export function compareCohortSummaries(legacy,nextOpen){
 const cohorts=[...new Set([...legacy,...nextOpen].map(x=>x.cohort))].sort();
 return cohorts.map(cohort=>{
  const old=legacy.find(x=>x.cohort===cohort);
  const current=nextOpen.find(x=>x.cohort===cohort);
  if(!old||!current||old.events!==current.events)throw Error("COHORT_MISMATCH");
  return {cohort,events:old.events,legacyMatured:old.matured,nextOpenMatured:current.matured,
   legacyMeanPct:old.averageReturnPct,nextOpenMeanPct:current.averageReturnPct,
   meanDifferencePct:old.averageReturnPct===null||current.averageReturnPct===null?null:
    Number((current.averageReturnPct-old.averageReturnPct).toFixed(3)),
   comparableMaturedCounts:old.matured===current.matured};
 });
}
