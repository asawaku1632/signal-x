import { inspectEvidencePair } from "./researchIndependentPairAudit.mjs";
// Fail-closed research summary; never a trading or promotion authorization.
const num = x => typeof x==="number" && Number.isFinite(x);
const date = x => typeof x==="string" && /^\d{4}-\d{2}-\d{2}$/.test(x);
const median = arr => {const s=[...arr].sort((a,b)=>a-b); const m=Math.floor(s.length/2);return s.length?(s.length%2?s[m]:(s[m-1]+s[m])/2):null};
export function summarizeReplicationEvidence(pairs,{minPairs=60,minDays=12,minStocks=20,minRegimes=3,maxConcentration=0.35}={}){
 const blockers=[];
 if(!Array.isArray(pairs)) return {status:"BLOCKED",blockers:["INVALID_PAIRS"],sampleSize:0};
 if(!Number.isSafeInteger(minPairs)||minPairs<1||!Number.isSafeInteger(minDays)||minDays<1||!Number.isSafeInteger(minStocks)||minStocks<1||!Number.isSafeInteger(minRegimes)||minRegimes<1||!num(maxConcentration)||maxConcentration<=0||maxConcentration>1) return {status:"BLOCKED",blockers:["INVALID_CONFIG"],sampleSize:0};
 if(pairs.length>5000) return {status:"BLOCKED",blockers:["EXCESSIVE_INPUT"],sampleSize:0};
 const days=new Set(),stocks=new Set(),regimes=new Set(),byDay=new Map(),byStock=new Map(),seen=new Set(),deltas=[];
 let invalid=0;
 for(const p of pairs){
   if(!p||typeof p!=="object"||!p.observation||!p.baseline||!p.shadow||!p.regime){invalid++;continue}
   const audit=inspectEvidencePair(p.observation,p.baseline,p.shadow,p.regime);
   if(audit.issues.length>1 || !audit.issues.includes("INDEPENDENT_ATTESTATION_REQUIRED")){invalid++;continue}
   const {trade_date,code}=p.observation,regime=p.regime.market_regime;
   if(!date(trade_date)||typeof code!=="string"||!["UP","DOWN","SIDEWAYS"].includes(regime)){invalid++;continue}
   const k=trade_date+"|"+code;
   if(seen.has(k)){invalid++;continue}
   seen.add(k);
   const delta=p.shadow.return_5d-p.baseline.return_5d;
   if(!num(delta)){invalid++;continue}
   days.add(trade_date);stocks.add(code);regimes.add(regime);deltas.push(delta);
   byDay.set(trade_date,(byDay.get(trade_date)||0)+1);
   byStock.set(code,(byStock.get(code)||0)+1);
 }
 if(invalid)blockers.push("INVALID_OR_DUPLICATE_PAIRS");
 if(deltas.length<minPairs)blockers.push("INSUFFICIENT_PAIRS");
 if(days.size<minDays)blockers.push("INSUFFICIENT_DAYS");
 if(stocks.size<minStocks)blockers.push("INSUFFICIENT_STOCKS");
 if(regimes.size<minRegimes)blockers.push("INSUFFICIENT_REGIMES");
 const concentration=deltas.length?Math.max(0,...byDay.values(),...byStock.values())/deltas.length:null;
 if(concentration!==null&&concentration>maxConcentration)blockers.push("EXCESSIVE_CONCENTRATION");
 const mean=deltas.length?deltas.reduce((a,b)=>a+b,0)/deltas.length:null;
 // Even adequate sample sizes cannot demonstrate licensed, independently attested data
 // or causal improvement. This is a descriptive research report only.
 blockers.push("INDEPENDENT_PROVENANCE_AND_OUT_OF_SAMPLE_REVIEW_REQUIRED");
 return {status:"BLOCKED",blockers,sampleSize:deltas.length,invalidPairs:invalid,distinctDays:days.size,distinctStocks:stocks.size,distinctRegimes:regimes.size,concentration,meanDelta:mean,medianDelta:median(deltas),positiveShare:deltas.length?deltas.filter(x=>x>0).length/deltas.length:null};
}
