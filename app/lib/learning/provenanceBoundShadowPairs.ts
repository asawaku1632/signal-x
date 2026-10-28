import {auditRegimeProvenance,type RegimeProvenance} from "@/app/lib/learning/shadowRegimeProvenance";
import {auditShadowRegimeReplication,type RegimePairedOutcome} from "@/app/lib/learning/shadowRegimeReplication";
// Provenance-aware research preview only. Do not accept missing or duplicate evidence.
export function auditProvenanceBoundShadowPairs(rows:RegimePairedOutcome[],proofs:RegimeProvenance[]){
 const issues:string[]=[];
 if(rows.length>1000||proofs.length>1000)throw Error("PROVENANCE_PAIR_LIMIT");
 const index=new Map<string,RegimeProvenance>();
 const duplicate=new Set<string>();
 for(const p of proofs){const key=p.signalDate+":"+p.code;if(index.has(key))duplicate.add(key);else index.set(key,p);}
 for(const key of duplicate)issues.push("DUPLICATE_PROVENANCE:"+key);
 for(const [i,row] of rows.entries()){
  const key=row.signalDate+":"+row.code;
  const proof=index.get(key);
  if(!proof){issues.push("MISSING_PROVENANCE:"+key);continue;}
  if(proof.regime!==row.regime)issues.push("REGIME_LABEL_MISMATCH:"+key);
  if(proof.signalGeneratedAt!==row.shadowSignalAt)issues.push("SIGNAL_TIME_MISMATCH:"+key);
  for(const reason of auditRegimeProvenance(proof).issues)issues.push("PROVENANCE_"+reason+":"+i);
 }
 for(const key of index.keys())if(!rows.some(row=>row.signalDate+":"+row.code===key))issues.push("ORPHAN_PROVENANCE:"+key);
 const replication=issues.length?null:auditShadowRegimeReplication(rows);
 const allIssues=[...issues,...(replication?.issues??[])];
 return {status:allIssues.length?"BLOCKED" as const:"BOUND_SHADOW_REVIEW_ONLY" as const,
  issues:allIssues,matchedPairs:rows.length-rows.filter(row=>!index.has(row.signalDate+":"+row.code)).length,
  summary:allIssues.length?null:replication?.summaries??null,
  independentProvenanceVerified:false as const,adoptionApproved:false as const,
  productionApplied:false as const,notificationEnabled:false as const};
}
