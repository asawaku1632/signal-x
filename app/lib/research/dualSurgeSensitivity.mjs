// Research-only price-proxy sensitivity. Costs are hypothetical percentages.
// No order execution, market access, persistence, or live recommendation.
export function costAdjustedOutcome(outcome,{roundTripCostPct=0}={}){
 if(!Number.isFinite(roundTripCostPct)||roundTripCostPct<0||roundTripCostPct>20)throw Error("INVALID_COST");
 if(!outcome||typeof outcome.status!=="string")throw Error("INVALID_OUTCOME");
 if(outcome.status!=="MATURED")return {status:outcome.status,grossReturnPct:null,netReturnPct:null,costPct:roundTripCostPct};
 if(!Number.isFinite(outcome.returnPct))throw Error("INVALID_RETURN");
 return {status:"MATURED",grossReturnPct:outcome.returnPct,netReturnPct:Number((outcome.returnPct-roundTripCostPct).toFixed(3)),costPct:roundTripCostPct};
}
export function sensitivityGrid(ledger,{horizon=5,metric="nextOpenToFutureClose",costs=[0,0.2,0.5,1]}={}){
 if(!Array.isArray(ledger)||![1,3,5,10].includes(horizon)||!["legacyCloseToClose","nextOpenToFutureClose"].includes(metric)||!Array.isArray(costs)||costs.length>20)throw Error("INVALID_GRID");
 const cohorts=[...new Set(ledger.map(x=>x.cohort))].sort();
 return cohorts.flatMap(cohort=>costs.map(cost=>{
  const events=ledger.filter(x=>x.cohort===cohort);
  const adjusted=events.map(x=>costAdjustedOutcome(x.outcomes?.[horizon]?.[metric],{roundTripCostPct:cost}));
  const matured=adjusted.filter(x=>x.status==="MATURED");
  const values=matured.map(x=>x.netReturnPct);
  return {cohort,horizon,metric,roundTripCostPct:cost,events:events.length,matured:matured.length,
   pending:adjusted.filter(x=>x.status==="PENDING").length,
   excluded:adjusted.filter(x=>x.status.startsWith("EXCLUDED")).length,
   positive:values.filter(x=>x>0).length,negative:values.filter(x=>x<0).length,
   meanNetReturnPct:values.length?Number((values.reduce((a,b)=>a+b,0)/values.length).toFixed(3)):null,
   insufficientSample:matured.length<30};
 }));
}
