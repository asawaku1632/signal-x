// Research-only, fail-closed independent provenance for market regime classifications.
// Do not infer independent evidence from asserted flags or stored labels alone.
export type RegimeProvenance={
 code:string;signalDate:string;regime:"UP"|"DOWN"|"SIDEWAYS";
 signalGeneratedAt:string;regimeCalculatedAt:string;marketBarEndAt:string;
 sourceProvider:string;sourceLicenseId:string;sourceDigest:string;
 algorithmVersion:string;independentTimestampEvidence:boolean;providerReviewed:boolean;
 licenseReviewed:boolean;barSnapshotImmutable:boolean;
};
export function auditRegimeProvenance(p:RegimeProvenance){
 const issues:string[]=[];
 if(!/^[0-9A-Za-z]{4,10}$/.test(p.code)||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(p.signalDate))issues.push("INVALID_ID");
 if(!["UP","DOWN","SIDEWAYS"].includes(p.regime))issues.push("UNKNOWN_REGIME");
 if(!/^[a-zA-Z0-9_.-]{1,80}$/.test(p.sourceProvider)||!/^[a-zA-Z0-9_.-]{1,80}$/.test(p.sourceLicenseId)||!/^[a-zA-Z0-9_.-]{1,80}$/.test(p.algorithmVersion)||!/^[a-f0-9]{64}$/.test(p.sourceDigest))issues.push("INVALID_PROVENANCE_SCOPE");
 const signal=Date.parse(p.signalGeneratedAt),regime=Date.parse(p.regimeCalculatedAt),bar=Date.parse(p.marketBarEndAt);
 if(![signal,regime,bar].every(Number.isFinite))issues.push("INVALID_TIMESTAMPS");
 else {
  if(bar>regime)issues.push("REGIME_BEFORE_BAR_END");
  if(regime>signal)issues.push("LOOKAHEAD_REGIME_CLASSIFICATION");
  if(p.signalGeneratedAt.slice(0,10)!==p.signalDate)issues.push("SIGNAL_DATE_MISMATCH");
 }
 if(!p.independentTimestampEvidence)issues.push("TIMESTAMP_EVIDENCE_MISSING");
 if(!p.providerReviewed)issues.push("PROVIDER_REVIEW_MISSING");
 if(!p.licenseReviewed)issues.push("LICENSE_REVIEW_MISSING");
 if(!p.barSnapshotImmutable)issues.push("IMMUTABLE_BAR_MISSING");
 return {status:issues.length?"BLOCKED" as const:"PROVENANCE_REVIEW_CANDIDATE" as const,issues,
  independentlyVerifiedByThisFunction:false as const,
  adoptionApproved:false as const,productionApplied:false as const,notificationEnabled:false as const};
}
