// Read-only aggregate diagnostic for swing_universe_observations.
// This is not a promotion or trading decision and performs no database I/O.
const count=(v)=>Number.isSafeInteger(v)&&v>=0;
const asCount=(v)=>typeof v==="string"&&/^\d+$/.test(v)&&Number.isSafeInteger(Number(v))?Number(v):v;
export function assessObservationCoverage(raw){
  if(!raw||typeof raw!=="object"||Array.isArray(raw))return {status:"BLOCKED",issues:["INVALID_SUMMARY"],verified:false};
  const names=["total","days","stocks","completed5","pending5","undated5","invalid_date","invalid_inputs","duplicates"];
  const v={};for(const n of names){v[n]=asCount(raw[n]);if(!count(v[n]))return {status:"BLOCKED",issues:["INVALID_COUNT_"+n],verified:false}}
  const issues=[];
  if(v.completed5+v.pending5!==v.total)issues.push("FIVE_DAY_COVERAGE_INCONSISTENT");
  if(v.undated5>0)issues.push("OUTCOME_WITHOUT_DATE");
  if(v.invalid_date>0)issues.push("OUTCOME_DATE_ORDER_INVALID");
  if(v.invalid_inputs>0)issues.push("INPUT_RANGE_INVALID");
  if(v.duplicates>0)issues.push("DUPLICATE_OBSERVATIONS");
  if(v.days>v.total||v.stocks>v.total)issues.push("IMPOSSIBLE_CARDINALITY");
  if(v.completed5===0)issues.push("NO_COMPLETED_FIVE_DAY_DATA");
  if(v.pending5>0)issues.push("PENDING_OUTCOMES");
  // Coverage by itself cannot establish provenance, counterfactuals, or forward validity.
  issues.push("SOURCE_LICENSE_NOT_ATTESTED","BASELINE_SHADOW_COMPARISON_NOT_ATTESTED","INDEPENDENT_FORWARD_VALIDATION_NOT_ATTESTED");
  return {status:"BLOCKED",verified:false,issues,total:v.total,completedFiveDay:v.completed5,pendingFiveDay:v.pending5,completionRate:v.total?v.completed5/v.total:null,distinctDays:v.days,distinctStocks:v.stocks};
}
