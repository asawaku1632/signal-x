import {auditRegimeProvenance,type RegimeProvenance} from "@/app/lib/learning/shadowRegimeProvenance";
import {auditShadowRegimeReplication,type RegimePairedOutcome} from "@/app/lib/learning/shadowRegimeReplication";
// Exact pair join. No subset silently accepted: one independent provenance record per pair.
export function auditProvenanceJoinedShadowRegimes(rows:RegimePairedOutcome[],proofs:RegimeProvenance[]){
 const issues:string[]=[];
 if(rows.length>1000||proofs.length>1000)throw Error("REGIME_JOIN_LIMIT");
 const key=(r:{code:string;signalDate:string})=>r.signalDate+":"+r.code;
 const map=new Map<string,RegimeProvenance>();
 for(const p of proofs){
  const k=key(p);
  if(map.has(k))issues.push("DUPLICATE_PROOF_"+k);
  map.set(k,p);
 }
 for(const r of rows){
  const k=key(r),p=map.get(k);
  if(!p){issues.push("PROOF_MISSING_"+k);continue;}
  if(p.regime!==r.regime)issues.push("REGIME_LABEL_MISMATCH_"+k);
  if(p.signalGeneratedAt!==r.shadowSignalAt)issues.push("SIGNAL_TIME_MISMATCH_"+k);
  if(p.marketBarEndAt!==r.barEndAt)issues.push("BAR_TIME_MISMATCH_"+k);
  const result=auditRegimeProvenance(p);
  for(const reason of result.issues)issues.push(reason+"_"+k);
 }
 const rowKeys=new Set(rows.map(key));
 for(const p of proofs)if(!rowKeys.has(key(p)))issues.push("UNMATCHED_PROOF_"+key(p));
 const replication=auditShadowRegimeReplication(rows);
 issues.push(...replication.issues);
 const passed=issues.length===0;
 return {status:passed?"PROVENANCE_JOIN_REVIEW_ONLY" as const:"BLOCKED" as const,issues,
  pairs:rows.length,proofs:proofs.length,
  summaries:passed?replication.summaries:[],
  independentlyAttestedByJoin:false as const,adoptionApproved:false as const,
  productionApplied:false as const,notificationEnabled:false as const};
}
