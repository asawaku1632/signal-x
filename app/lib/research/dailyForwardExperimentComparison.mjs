/**
 * Paired offline comparison of frozen baseline and experimental AI predictions.
 * Expects independently verified outcome rows; never infers verification.
 * A paired comparison is descriptive, not causal proof or trading profitability.
 */
export function compareForwardExperimentOutcomes(plan, baselineRows, experimentalRows, {
  minPairedSamples=100,
}={}) {
  if (!plan || plan.status!=="DESIGN_ONLY_NOT_EXECUTED" ||
      plan.autoApply!==false || plan.productionApproval!==false ||
      !Array.isArray(baselineRows) || !Array.isArray(experimentalRows)) {
    return {status:"BLOCKED",reasons:["INVALID_PLAN_OR_DATA"],autoApply:false,productionWrites:false};
  }
  const reasons=[];
  if (!Number.isInteger(minPairedSamples)||minPairedSamples<30) reasons.push("INVALID_MIN_SAMPLE");
  const makeIndex=(rows,label)=>{
    const map=new Map();
    for(const row of rows){
      if (!row || typeof row.code!=="string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.date??"") ||
          !Number.isInteger(row.horizon)||row.horizon<=0) {
        reasons.push(label+"_INVALID_KEY"); continue;
      }
      const key=`${row.code}|${row.date}|${row.horizon}`;
      if(map.has(key)) reasons.push(label+"_DUPLICATE_KEY");
      map.set(key,row);
    }
    return map;
  };
  const baseline=makeIndex(baselineRows,"BASELINE");
  const experimental=makeIndex(experimentalRows,"EXPERIMENT");
  if (baseline.size!==experimental.size ||
      [...baseline.keys()].some(k=>!experimental.has(k))) reasons.push("UNPAIRED_OBSERVATIONS");
  const paired=[];
  for(const [key,b] of baseline){
    const e=experimental.get(key);
    if(!e) continue;
    if(b.status!=="VERIFIED"||e.status!=="VERIFIED" ||
       b.priceBasisVerified!==true||e.priceBasisVerified!==true ||
       typeof b.returnPct!=="number"||!Number.isFinite(b.returnPct) ||
       typeof e.returnPct!=="number"||!Number.isFinite(e.returnPct)) {
      reasons.push("UNVERIFIED_PAIRED_OUTCOME");continue;
    }
    if(b.date<plan.holdoutStart||b.date>plan.holdoutEnd) {
      reasons.push("OUTSIDE_HOLDOUT_WINDOW");continue;
    }
    paired.push({key,baselineReturnPct:b.returnPct,experimentalReturnPct:e.returnPct});
  }
  if(paired.length<minPairedSamples) reasons.push("INSUFFICIENT_PAIRED_SAMPLES");
  const avg=(field)=>paired.length?paired.reduce((sum,r)=>sum+r[field],0)/paired.length:null;
  const baselineAverageReturnPct=avg("baselineReturnPct");
  const experimentalAverageReturnPct=avg("experimentalReturnPct");
  return {status:reasons.length?"BLOCKED":"DESCRIPTIVE_COMPARISON_ONLY",
    reasons:[...new Set(reasons)],pairedSamples:paired.length,
    baselineAverageReturnPct,experimentalAverageReturnPct,
    averageDifferencePctPoints:reasons.length?null:experimentalAverageReturnPct-baselineAverageReturnPct,
    improvementProven:false,autoApply:false,productionWrites:false,productionApproval:false,
    note:"No statistical significance, transaction cost, slippage, drawdown, or independent provenance assessment is performed here.",
  };
}
