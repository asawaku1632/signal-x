// Research-only, bounded comparison of two independently captured sample summaries.
// Comparison is descriptive and never claims model improvement or market prediction.
export type EvidenceSnapshot={label:string;sampled:number;counts:Record<string,number>;fingerprint:string;ruleVersion:string};
export function compareEvidenceSnapshots(before:EvidenceSnapshot,after:EvidenceSnapshot){
 for(const s of [before,after]){
  if(!/^[a-zA-Z0-9_-]{1,60}$/.test(s.label)||!/^[a-z0-9_.-]{1,80}$/i.test(s.ruleVersion)||!/^[a-f0-9]{32}$/.test(s.fingerprint)||!Number.isSafeInteger(s.sampled)||s.sampled<0||s.sampled>1000||Object.keys(s.counts).length>100)throw Error("INVALID_EVIDENCE_SNAPSHOT");
  for(const [key,value] of Object.entries(s.counts))if(!/^[A-Z0-9_]{1,100}$/.test(key)||!Number.isSafeInteger(value)||value<0||value>s.sampled)throw Error("INVALID_EVIDENCE_COUNTS");
 }
 const comparable=before.fingerprint===after.fingerprint&&before.ruleVersion===after.ruleVersion&&before.sampled===after.sampled;
 const keys=[...new Set([...Object.keys(before.counts),...Object.keys(after.counts)])].sort();
 const changes=keys.map(code=>{const oldCount=before.counts[code]??0,newCount=after.counts[code]??0;return {code,before:oldCount,after:newCount,delta:newCount-oldCount,direction:!comparable?"NOT_COMPARABLE":newCount<oldCount?"IMPROVED":newCount>oldCount?"WORSENED":"UNCHANGED"};});
 return {comparable,reason:comparable?null:"SNAPSHOT_SCOPE_MISMATCH",changes,baseline:before.label,current:after.label,
  verifiedImprovement:false as const,adoptionApproved:false as const,productionApplied:false as const,notificationEnabled:false as const};
}
