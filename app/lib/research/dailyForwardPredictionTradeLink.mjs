/**
 * Link hypothetical trades to the exact experimental prediction observation.
 * This does not establish executable prices, transaction timing, or real P&L.
 */
export function linkForwardPredictionsToHypotheticalTrades(experimentalRows,trades) {
  const reasons=[];
  if(!Array.isArray(experimentalRows)||!Array.isArray(trades)) {
    return {status:"BLOCKED",reasons:["INVALID_INPUT"],linkedTrades:[],
      autoApply:false,productionWrites:false};
  }
  const predictions=new Map();
  for(const p of experimentalRows) {
    if(!p||typeof p.code!=="string"||typeof p.date!=="string"||
       !Number.isInteger(p.horizon)||p.horizon<=0||
       p.status!=="VERIFIED"||p.priceBasisVerified!==true||
       !Number.isFinite(p.returnPct)) {reasons.push("INVALID_PREDICTION");continue;}
    const key=`${p.code}|${p.date}|${p.horizon}`;
    if(predictions.has(key)) reasons.push("DUPLICATE_PREDICTION");
    predictions.set(key,p);
  }
  const linkedTrades=[],seen=new Set();
  for(const t of trades) {
    if(!t||typeof t.id!=="string"||!t.id||
       typeof t.code!=="string"||typeof t.signalDate!=="string"||
       !Number.isInteger(t.horizon)||t.horizon<=0||
       typeof t.startDate!=="string"||typeof t.endDate!=="string"||
       !/^\d{4}-\d{2}-\d{2}$/.test(t.signalDate)||
       !/^\d{4}-\d{2}-\d{2}$/.test(t.startDate)||
       !/^\d{4}-\d{2}-\d{2}$/.test(t.endDate)||
       t.startDate<t.signalDate||t.endDate<t.startDate||
       t.verified!==true||!Number.isFinite(t.grossReturnPct)) {
      reasons.push("INVALID_TRADE");continue;
    }
    if(seen.has(t.id)) reasons.push("DUPLICATE_TRADE_ID");
    seen.add(t.id);
    const key=`${t.code}|${t.signalDate}|${t.horizon}`;
    const prediction=predictions.get(key);
    if(!prediction) {reasons.push("NO_MATCHING_VERIFIED_PREDICTION");continue;}
    if(t.priceBasisVerified!==true||t.executionBasisVerified!==true) {
      reasons.push("TRADE_EXECUTION_BASIS_UNVERIFIED");continue;
    }
    linkedTrades.push({...t,predictionKey:key,predictedForwardReturnPct:prediction.returnPct});
  }
  if(trades.length!==linkedTrades.length) reasons.push("INCOMPLETE_TRADE_LINKAGE");
  return {status:reasons.length?"BLOCKED":"LINKED_FOR_OFFLINE_RESEARCH_ONLY",
    reasons:[...new Set(reasons)],linkedTrades:reasons.length?[]:linkedTrades,
    linkedCount:reasons.length?0:linkedTrades.length,
    improvementProven:false,autoApply:false,productionWrites:false,productionApproval:false,
    note:"Matching keys and caller-supplied verification flags do not independently prove execution prices, fills, timing, licensed data, or trading returns.",
  };
}
