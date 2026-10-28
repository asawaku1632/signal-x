// Research-only pre-adoption FORWARD evidence gate. No source is attested merely by setting a boolean.
export type ForwardProof={researchId:string;ruleVersion:string;candidateCount:number;distinctStocks:number;tradingDays:number;completedMonths:number;avg5d:number|null;median5d:number|null;positiveRate:number|null;marketRegimes:number;providerVerified:boolean;licenseVerified:boolean;independentSignalTimeVerified:boolean;holdoutVerified:boolean;calendarVerified:boolean;datasetFingerprint:string};
export function evaluateForwardProof(p:ForwardProof){
 const issues:string[]=[];
 if(!/^[a-zA-Z0-9_-]{1,80}$/.test(p.researchId)||!/^[a-zA-Z0-9_.-]{1,80}$/.test(p.ruleVersion))issues.push("INVALID_SCOPE");
 if(!/^[a-f0-9]{32}$/.test(p.datasetFingerprint))issues.push("INVALID_DATASET_FINGERPRINT");
 for(const [k,v] of Object.entries({candidateCount:p.candidateCount,distinctStocks:p.distinctStocks,tradingDays:p.tradingDays,completedMonths:p.completedMonths,marketRegimes:p.marketRegimes})){
  if(!Number.isSafeInteger(v)||v<0||v>1000000)issues.push("INVALID_"+k.toUpperCase());
 }
 if(p.distinctStocks>p.candidateCount||p.completedMonths>p.tradingDays)issues.push("INVALID_COVERAGE_RELATION");
 if(!p.candidateCount||!p.distinctStocks||!p.tradingDays||!p.completedMonths)issues.push("INSUFFICIENT_FORWARD_COVERAGE");
 if(!p.marketRegimes)issues.push("NO_MARKET_REGIME_REPLICATION");
 for(const [k,v] of Object.entries({avg5d:p.avg5d,median5d:p.median5d,positiveRate:p.positiveRate})){
  if(v===null||typeof v!=="number"||!Number.isFinite(v)||(k==="positiveRate"&&(v<0||v>1)))issues.push("INVALID_METRIC_"+k.toUpperCase());
 }
 if(!p.providerVerified)issues.push("PROVIDER_UNVERIFIED");
 if(!p.licenseVerified)issues.push("LICENSE_UNVERIFIED");
 if(!p.independentSignalTimeVerified)issues.push("SIGNAL_TIME_UNVERIFIED");
 if(!p.holdoutVerified)issues.push("HOLDOUT_UNVERIFIED");
 if(!p.calendarVerified)issues.push("CALENDAR_UNVERIFIED");
 return {status:issues.length?"BLOCKED" as const:"HUMAN_REVIEW_CANDIDATE" as const,issues,
  requiresHumanReview:true as const,independentlyAttestedByThisFunction:false as const,
  adoptionApproved:false as const,productionApplied:false as const,notificationEnabled:false as const};
}
