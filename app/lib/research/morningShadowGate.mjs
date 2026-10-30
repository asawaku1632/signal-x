/** Offline notification readiness gate. No IO, sends nothing, defaults to BLOCKED.
 * Thresholds are conservative research policy defaults, not evidence of profitability.
 */
const finite=n=>typeof n==="number"&&Number.isFinite(n);
const unique=x=>new Set(x).size;
export function evaluateMorningShadowGate(rows,options={}){
  if(!Array.isArray(rows)||rows.length>100000)throw Error("INVALID_SHADOW_ROWS");
  const policy={minCandidates:100,minStocks:20,minTradingDays:30,minMonths:3,
    minRegimes:2,minRegimeSamples:15,minPositiveRate:0.55,minMeanReturnPct:0,
    minMedianReturnPct:0,minBaselineLift:0.05,maxBrier:0.25,
    ...options};
  const reasons=[];
  const seen=new Set(),valid=[];
  let duplicate=0,invalid=0;
  for(const r of rows){
    if(!r||typeof r.code!=="string"||!/^(?:\d{4}|\d{3}[A-Z])$/.test(r.code)||
      typeof r.tradeDate!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(r.tradeDate)||
      !finite(r.forward5dReturnPct)||!finite(r.predictedProbability)||
      r.predictedProbability<0||r.predictedProbability>1||
      typeof r.regime!=="string"||!r.regime.trim()||
      r.independentlyVerified!==true||r.pointInTimeVerified!==true||
      r.outcomeMatured!==true||r.outOfSample!==true){
      invalid++;continue;
    }
    const key=r.code+"|"+r.tradeDate;
    if(seen.has(key)){duplicate++;continue;}
    seen.add(key);valid.push(r);
  }
  if(invalid)reasons.push("UNVERIFIED_OR_INVALID_ROWS");
  if(duplicate)reasons.push("DUPLICATE_STOCK_DATES");
  const n=valid.length;
  const stocks=unique(valid.map(r=>r.code));
  const days=unique(valid.map(r=>r.tradeDate));
  const months=unique(valid.map(r=>r.tradeDate.slice(0,7)));
  const regimes={};
  for(const r of valid)(regimes[r.regime]??=[]).push(r);
  const regimeCounts=Object.fromEntries(Object.entries(regimes).map(([k,v])=>[k,v.length]));
  const returns=valid.map(r=>r.forward5dReturnPct).sort((a,b)=>a-b);
  const mean=n?returns.reduce((a,b)=>a+b,0)/n:null;
  const median=n?(returns[Math.floor((n-1)/2)]+returns[Math.floor(n/2)])/2:null;
  const positiveRate=n?returns.filter(x=>x>0).length/n:null;
  const brier=n?valid.reduce((s,r)=>s+(r.predictedProbability-(r.forward5dReturnPct>0?1:0))**2,0)/n:null;
  const baselineRate=n?valid.filter(r=>r.forward5dReturnPct>0).length/n:null;
  const baselineBrier=baselineRate===null?null:valid.reduce((s,r)=>s+(baselineRate-(r.forward5dReturnPct>0?1:0))**2,0)/n;
  // In-sample constant baseline is optimistic: a separate chronological baseline is required.
  const baselineLift=null;
  if(n<policy.minCandidates)reasons.push("INSUFFICIENT_CANDIDATES");
  if(stocks<policy.minStocks)reasons.push("INSUFFICIENT_STOCKS");
  if(days<policy.minTradingDays)reasons.push("INSUFFICIENT_TRADING_DAYS");
  if(months<policy.minMonths)reasons.push("INSUFFICIENT_MONTHS");
  if(Object.keys(regimes).length<policy.minRegimes||
     Object.values(regimes).some(group=>group.length<policy.minRegimeSamples))
    reasons.push("INSUFFICIENT_REGIME_REPLICATION");
  if(n&&positiveRate<policy.minPositiveRate)reasons.push("LOW_POSITIVE_RATE");
  if(n&&mean<=policy.minMeanReturnPct)reasons.push("NONPOSITIVE_MEAN_RETURN");
  if(n&&median<=policy.minMedianReturnPct)reasons.push("NONPOSITIVE_MEDIAN_RETURN");
  if(n&&brier>policy.maxBrier)reasons.push("POOR_PROBABILITY_CALIBRATION");
  reasons.push("CHRONOLOGICAL_BASELINE_NOT_VERIFIED");
  return {version:"MORNING_SHADOW_GATE_V1",status:"BLOCKED",
    shadowEligible:reasons.length===1&&reasons[0]==="CHRONOLOGICAL_BASELINE_NOT_VERIFIED",
    notificationEnabled:false,readyForTrading:false,
    counts:{received:rows.length,accepted:n,invalid,duplicate,stocks,tradingDays:days,months,regimeCounts},
    metrics:{mean5dReturnPct:mean,median5dReturnPct:median,positiveRate,brier,baselineBrierInSample:baselineBrier,baselineLift},
    reasons,policy,note:"Research-only gate. Requires separately verified chronological baseline and external authorization; never sends notifications."};
}
