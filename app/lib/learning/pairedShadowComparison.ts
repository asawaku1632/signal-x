// SHADOW-only paired outcomes. A valid pair is not evidence of live predictive value.
export type PairedOutcome={code:string;signalDate:string;outcomeDate:string;baselineReturn5d:number;shadowReturn5d:number;baselineSignalAt:string;shadowSignalAt:string;barEndAt:string;ruleVersion:string;sourceFingerprint:string;licensed:boolean;independentTimestamps:boolean;holdout:boolean};
export function evaluatePairedShadowComparison(rows:PairedOutcome[],maxRows=1000){
 if(!Number.isSafeInteger(maxRows)||maxRows<1||maxRows>1000||rows.length>maxRows)throw Error("INVALID_PAIR_LIMIT");
 const issues:string[]=[];let deltaSum=0,positiveDelta=0;const keys=new Set<string>();let scope:string|null=null;
 for(const [i,r] of rows.entries()){
  const key=r.signalDate+":"+r.code;
  if(!/^[0-9A-Za-z]{4,10}$/.test(r.code)||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(r.signalDate)||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(r.outcomeDate))issues.push("INVALID_PAIR_KEY_"+i);
  if(keys.has(key))issues.push("DUPLICATE_PAIR_"+i);keys.add(key);
  if(!Number.isFinite(r.baselineReturn5d)||!Number.isFinite(r.shadowReturn5d))issues.push("INVALID_RETURN_"+i);
  if(!r.licensed||!r.independentTimestamps||!r.holdout)issues.push("PROOF_MISSING_"+i);
  if(!/^[a-f0-9]{32}$/.test(r.sourceFingerprint)||!/^[a-zA-Z0-9_.-]{1,80}$/.test(r.ruleVersion))issues.push("INVALID_SCOPE_"+i);
  const localScope=r.ruleVersion+":"+r.sourceFingerprint;
  if(scope!==null&&scope!==localScope)issues.push("MIXED_SCOPE_"+i);scope=scope??localScope;
  const t=[r.baselineSignalAt,r.shadowSignalAt,r.barEndAt].map(x=>Date.parse(x));
  if(t.some(x=>!Number.isFinite(x))||t[0]>t[2]||t[1]>t[2]||Date.parse(r.outcomeDate)<=Date.parse(r.signalDate))issues.push("TEMPORAL_LEAKAGE_"+i);
  const delta=r.shadowReturn5d-r.baselineReturn5d;
  if(Number.isFinite(delta)){deltaSum+=delta;if(delta>0)positiveDelta++;}
 }
 if(!rows.length)issues.push("EMPTY_PAIRS");
 const valid=issues.length===0;
 return {status:valid?"SHADOW_COMPARISON_REVIEW_ONLY" as const:"BLOCKED" as const,issues,pairedCount:rows.length,
  averageDelta5d:valid?deltaSum/rows.length:null,positiveDeltaRate:valid?positiveDelta/rows.length:null,
  verifiedPredictiveImprovement:false as const,adoptionApproved:false as const,productionApplied:false as const,notificationEnabled:false as const};
}
