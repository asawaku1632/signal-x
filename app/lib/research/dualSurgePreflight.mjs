import {validIsoSessionDate} from "./dualSurgeCalendar.mjs";
// Research-only preflight; consumes caller-supplied rows. Never fetches or writes data.
export const PREFLIGHT_VERSION="DUAL_SURGE_PREFLIGHT_V1";
const validNumber=x=>typeof x==="number"&&Number.isFinite(x)&&x>0;
export function inspectProviderRows(rows,code){
 if(!Array.isArray(rows)||typeof code!=="string"||!/^[0-9]{4}$/.test(code))throw Error("INVALID_INPUT");
 const counts={received:rows.length,wrongCode:0,invalidDate:0,invalidOHLCV:0,missingAdjustment:0,corporateAction:0,duplicateDates:0};
 const seen=new Set();
 for(const r of rows){
  if(!r||typeof r.Code!=="string"||(r.Code!==code&&r.Code!==code+"0")){counts.wrongCode++;continue;}
  if(!validIsoSessionDate(r.Date)){counts.invalidDate++;continue;}
  if(![r.O,r.H,r.L,r.C].every(validNumber)||typeof r.Vo!=="number"||!Number.isFinite(r.Vo)||r.Vo<0||r.H<Math.max(r.O,r.C,r.L)||r.L>Math.min(r.O,r.C)||r.H<r.L){counts.invalidOHLCV++;continue;}
  if(seen.has(r.Date))counts.duplicateDates++;
  seen.add(r.Date);
  if(typeof r.AdjFactor!=="number"||!Number.isFinite(r.AdjFactor)||r.AdjFactor<=0)counts.missingAdjustment++;
  else if(r.AdjFactor!==1)counts.corporateAction++;
 }
 const clean=Object.entries(counts).every(([k,v])=>k==="received"||v===0);
 return {code,version:PREFLIGHT_VERSION,counts,clean,eligibleForStrictComparison:clean&&rows.length>=22,
  noAutomaticFetch:true,noPersistence:true};
}
export function studyCoverage(studies){
 if(!Array.isArray(studies))throw Error("INVALID_INPUT");
 const unique=new Set();
 for(const s of studies){
  if(!s||typeof s.code!=="string"||unique.has(s.code))throw Error("DUPLICATE_OR_INVALID_STUDY");
  unique.add(s.code);
 }
 return {stocks:studies.length,cleanStocks:studies.filter(s=>s.clean).length,
  comparisonEligibleStocks:studies.filter(s=>s.eligibleForStrictComparison).length,
  excludedStocks:studies.filter(s=>!s.eligibleForStrictComparison).map(s=>({code:s.code,counts:s.counts})),
  insufficientCoverage:studies.filter(s=>s.eligibleForStrictComparison).length<20};
}
export function maturityTable(ledger){
 if(!Array.isArray(ledger))throw Error("INVALID_INPUT");
 const cohorts=[...new Set(ledger.map(e=>e.cohort))].sort();
 return cohorts.flatMap(cohort=>[1,3,5,10].map(horizon=>{
  const group=ledger.filter(e=>e.cohort===cohort);
  const tally=metric=>{
   const o=group.map(e=>e.outcomes?.[horizon]?.[metric]);
   if(o.some(x=>!x||!["MATURED","PENDING","EXCLUDED_CORPORATE_OR_UNKNOWN_ADJUSTMENT","EXCLUDED_MISSING_DATA"].includes(x.status)))throw Error("INVALID_OUTCOME");
   return {matured:o.filter(x=>x.status==="MATURED").length,pending:o.filter(x=>x.status==="PENDING").length,
    excluded:o.filter(x=>x.status.startsWith("EXCLUDED")).length};
  };
  return {cohort,horizon,events:group.length,legacy:tally("legacyCloseToClose"),nextOpen:tally("nextOpenToFutureClose")};
 }));
}
