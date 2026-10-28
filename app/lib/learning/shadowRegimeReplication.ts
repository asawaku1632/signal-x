import {auditShadowConcentration} from "@/app/lib/learning/shadowConcentrationAudit";
import type {PairedOutcome} from "@/app/lib/learning/pairedShadowComparison";
export type RegimePairedOutcome=PairedOutcome&{regime:"UP"|"DOWN"|"SIDEWAYS"};
export function auditShadowRegimeReplication(rows:RegimePairedOutcome[]){
 const concentration=auditShadowConcentration(rows);
 const regimes=["UP","DOWN","SIDEWAYS"] as const;
 const summaries=regimes.map(regime=>{
  const subset=rows.filter(r=>r.regime===regime);
  const dates=new Set(subset.map(r=>r.signalDate));
  const stocks=new Set(subset.map(r=>r.code));
  const deltas=subset.map(r=>r.shadowReturn5d-r.baselineReturn5d);
  return {regime,count:subset.length,dates:dates.size,stocks:stocks.size,
    averageDelta:subset.length&&deltas.every(Number.isFinite)?deltas.reduce((a,b)=>a+b,0)/subset.length:null};
 });
 const issues=[...concentration.issues];
 if(rows.some(r=>!regimes.includes(r.regime)))issues.push("UNKNOWN_MARKET_REGIME");
 for(const x of summaries){
  if(x.count<5||x.dates<2||x.stocks<3)issues.push("INSUFFICIENT_REGIME_"+x.regime);
 }
 const safe=issues.length===0;
 return {status:safe?"REGIME_REVIEW_ONLY" as const:"BLOCKED" as const,
  issues,summaries:safe?summaries:summaries.map(x=>({...x,averageDelta:null})),
  verifiedMarketRobustness:false as const,adoptionApproved:false as const,
  productionApplied:false as const,notificationEnabled:false as const};
}
