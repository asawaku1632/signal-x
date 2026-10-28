export type EvidenceReviewSnapshot={sampled:number;ruleVersion:string;observedAt:string;reasonCounts:Record<string,number>;completeHistory:false};
export function compareEvidenceReviewSnapshots(before:EvidenceReviewSnapshot,after:EvidenceReviewSnapshot){
 if(before.ruleVersion!==after.ruleVersion||!before.ruleVersion)throw Error("RULE_SCOPE_CHANGED");
 if(!Number.isSafeInteger(before.sampled)||!Number.isSafeInteger(after.sampled)||before.sampled<0||after.sampled<0||before.sampled>1000||after.sampled>1000)throw Error("INVALID_SAMPLE_SIZE");
 if(!Number.isFinite(Date.parse(before.observedAt))||!Number.isFinite(Date.parse(after.observedAt))||Date.parse(before.observedAt)>=Date.parse(after.observedAt))throw Error("INVALID_REVIEW_CHRONOLOGY");
 const keys=[...new Set([...Object.keys(before.reasonCounts),...Object.keys(after.reasonCounts)])].sort();
 const differences=keys.map(code=>{
  if(!/^[A-Z0-9_]{1,100}$/.test(code))throw Error("INVALID_REASON_CODE");
  const older=before.reasonCounts[code]??0,newer=after.reasonCounts[code]??0;
  if(!Number.isSafeInteger(older)||!Number.isSafeInteger(newer)||older<0||newer<0||older>before.sampled||newer>after.sampled)throw Error("INVALID_REASON_COUNT");
  return {code,before:older,after:newer,delta:newer-older,direction:newer<older?"LOWER_COUNT" as const:newer>older?"HIGHER_COUNT" as const:"UNCHANGED" as const};
 });
 const comparable=before.sampled===after.sampled&&before.completeHistory===false&&after.completeHistory===false;
 return {differences,comparableSampleSize:comparable,improvementProven:false as const,reason:"SAMPLE_COMPOSITION_AND_INDEPENDENT_PROVENANCE_NOT_ATTESTED" as const,
  adoptionApproved:false as const,productionApplied:false as const,notificationEnabled:false as const};
}
