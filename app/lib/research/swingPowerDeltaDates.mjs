/** Offline score-change audit. Takes per-date cohort aggregates, not stock-level independent trials. */
export function auditSwingPowerDeltaDates(rows,{minPerCohort=10,minDates=20}={}){
 if(!Array.isArray(rows)||!Number.isInteger(minPerCohort)||minPerCohort<2||!Number.isInteger(minDates)||minDates<2)throw Error("INVALID_POWER_DELTA_AUDIT");
 const seen=new Set(),eligible=[];let insufficient=0;
 for(const r of rows){
  const d=r?.date;
  if(typeof d!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d+"T00:00:00Z"))||new Date(d+"T00:00:00Z").toISOString().slice(0,10)!==d||seen.has(d))throw Error("INVALID_OR_DUPLICATE_POWER_DELTA_DATE");
  seen.add(d);
  if(!Number.isInteger(r.upCount)||r.upCount<minPerCohort||!Number.isInteger(r.downCount)||r.downCount<minPerCohort||!Number.isFinite(r.upMean)||!Number.isFinite(r.downMean)){insufficient++;continue;}
  eligible.push({date:d,gapPp:r.upMean-r.downMean});
 }
 const gaps=eligible.map(x=>x.gapPp);const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
 const omitted=gaps.length>1?gaps.map((_,i)=>mean(gaps.filter((__,j)=>j!==i))):[];
 return {comparableDates:gaps.length,insufficientDates:insufficient,equalDateGapPp:mean(gaps),upBetterDates:gaps.filter(x=>x>0).length,
  leaveOneDateOutRange:omitted.length?[Math.min(...omitted),Math.max(...omitted)]:null,
  status:gaps.length<minDates?"INSUFFICIENT_INDEPENDENT_DATES":"DESCRIPTIVE_ONLY",
  verifiedPredecision:false,readyForTraining:false,readyForTrading:false,
  warning:"Overlapping 5d horizons and unverified score timestamp/source prevent prospective efficacy claims."};
}
