// Offline statistical diagnostics only. No predictive accuracy or investment claims.
function wilson(successes,total,z=1.96){
 const p=successes/total,denom=1+z*z/total;
 const center=(p+z*z/(2*total))/denom;
 const margin=z*Math.sqrt((p*(1-p)+z*z/(4*total))/total)/denom;
 return {lower:Number(Math.max(0,center-margin).toFixed(4)),upper:Number(Math.min(1,center+margin).toFixed(4))};
}
export function assessDualSurgeSample({
 outcomes,baselineOutcomes,minimumMatured=30,minimumBaseline=30
}={}){
 if(!Array.isArray(outcomes)||!Array.isArray(baselineOutcomes))throw Error("INVALID_STATISTICAL_INPUT");
 const valid=(item)=>item&&typeof item==="object"&&["MATURED","PENDING","EXCLUDED"].includes(item.status)&&(item.status!=="MATURED"||(typeof item.returnPct==="number"&&Number.isFinite(item.returnPct)));
 if(!outcomes.every(valid)||!baselineOutcomes.every(valid))throw Error("INVALID_STATISTICAL_OUTCOME");
 const tally=(rows)=>{const matured=rows.filter(x=>x.status==="MATURED");return {total:rows.length,matured:matured.length,pending:rows.filter(x=>x.status==="PENDING").length,excluded:rows.filter(x=>x.status==="EXCLUDED").length,positive:matured.filter(x=>x.returnPct>0).length};};
 const signal=tally(outcomes),baseline=tally(baselineOutcomes);
 const reasons=[];
 if(!Number.isInteger(minimumMatured)||minimumMatured<2||!Number.isInteger(minimumBaseline)||minimumBaseline<2)reasons.push("INVALID_SAMPLE_THRESHOLD");
 if(signal.matured<minimumMatured)reasons.push("INSUFFICIENT_SIGNAL_SAMPLE");
 if(baseline.matured<minimumBaseline)reasons.push("INSUFFICIENT_BASELINE_SAMPLE");
 const signalRate=signal.matured?signal.positive/signal.matured:null;
 const baselineRate=baseline.matured?baseline.positive/baseline.matured:null;
 return {sufficient:reasons.length===0,reasons,signal,baseline,signalPositiveRate:signalRate,baselinePositiveRate:baselineRate,observedDifference:signalRate===null||baselineRate===null?null:Number((signalRate-baselineRate).toFixed(4)),signalWilson95:signal.matured?wilson(signal.positive,signal.matured):null,baselineWilson95:baseline.matured?wilson(baseline.positive,baseline.matured):null,readOnly:true,productionApproved:false};
}
