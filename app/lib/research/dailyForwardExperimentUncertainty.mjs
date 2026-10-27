/**
 * Conservative descriptive uncertainty diagnostics for paired offline experiments.
 * Clusters by signal date, not by individual stock, to avoid treating correlated
 * same-day stock outcomes as independent observations. Not a significance test.
 */
export function assessForwardExperimentUncertainty(pairedRows, {
  minDistinctDates=20, minDistinctCodes=20, maxSingleDateShare=0.15,
}={}) {
  if (!Array.isArray(pairedRows)) throw new TypeError("pairedRows must be an array");
  const reasons=[],byDate=new Map(),codes=new Set(),keys=new Set();
  for (const row of pairedRows) {
    if (!row || typeof row.code!=="string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.date??"") ||
      !Number.isFinite(row.baselineReturnPct)||!Number.isFinite(row.experimentalReturnPct)) {
      reasons.push("INVALID_PAIRED_ROW");continue;
    }
    const key=`${row.code}|${row.date}|${row.horizon??"NA"}`;
    if(keys.has(key)) reasons.push("DUPLICATE_PAIRED_ROW");
    keys.add(key);codes.add(row.code);
    const values=byDate.get(row.date)??[];
    values.push(row.experimentalReturnPct-row.baselineReturnPct);
    byDate.set(row.date,values);
  }
  const dateMeans=[...byDate.values()].map(v=>v.reduce((a,b)=>a+b,0)/v.length);
  const mean=dateMeans.length?dateMeans.reduce((a,b)=>a+b,0)/dateMeans.length:null;
  const variance=dateMeans.length>1?dateMeans.reduce((s,v)=>s+(v-mean)**2,0)/(dateMeans.length-1):null;
  const standardError=variance===null?null:Math.sqrt(variance/dateMeans.length);
  const maxDateShare=keys.size?Math.max(0,...[...byDate.values()].map(v=>v.length))/keys.size:null;
  if(byDate.size<minDistinctDates) reasons.push("INSUFFICIENT_DISTINCT_DATES");
  if(codes.size<minDistinctCodes) reasons.push("INSUFFICIENT_DISTINCT_CODES");
  if(maxDateShare!==null&&maxDateShare>maxSingleDateShare) reasons.push("DATE_CONCENTRATION");
  if(!Number.isInteger(minDistinctDates)||minDistinctDates<2||
     !Number.isInteger(minDistinctCodes)||minDistinctCodes<2||
     !Number.isFinite(maxSingleDateShare)||maxSingleDateShare<=0||maxSingleDateShare>1) {
    reasons.push("INVALID_THRESHOLDS");
  }
  return {status:reasons.length?"INSUFFICIENT_EVIDENCE":"DESCRIPTIVE_DIAGNOSTICS_ONLY",
    reasons:[...new Set(reasons)],pairedCount:keys.size,distinctDates:byDate.size,
    distinctCodes:codes.size,maxSingleDateShare:maxDateShare,
    equalDateWeightedMeanDifferencePctPoints:mean,
    dateClusterStandardErrorPctPoints:standardError,
    improvementProven:false,productionApproval:false,autoApply:false,
    note:"Descriptive date-cluster uncertainty only; overlapping holding periods, market regimes, costs, slippage, and multiple testing require separate independent review.",
  };
}
