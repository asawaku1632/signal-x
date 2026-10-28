import {auditProvenanceJoinedShadowRegimes} from "@/app/lib/learning/shadowRegimeEvidenceJoin";
import type {RegimePairedOutcome} from "@/app/lib/learning/shadowRegimeReplication";
import type {RegimeProvenance} from "@/app/lib/learning/shadowRegimeProvenance";
// Bounded read-only review summary, not a provenance attestation or model promotion.
export function summarizeRegimeEvidenceReview(rows:RegimePairedOutcome[],proofs:RegimeProvenance[]){
 const result=auditProvenanceJoinedShadowRegimes(rows,proofs);
 const reasonCounts:Record<string,number>={};
 for(const reason of result.issues){
  const category=reason.replace(/_[0-9]{4}-[0-9]{2}-[0-9]{2}:[0-9A-Za-z]+$/,"");
  reasonCounts[category]=(reasonCounts[category]??0)+1;
 }
 const distinctDays=new Set(rows.map(x=>x.signalDate)).size;
 const distinctStocks=new Set(rows.map(x=>x.code)).size;
 const matchedPairs=result.status==="PROVENANCE_JOIN_REVIEW_ONLY"?result.pairs:0;
 return {status:result.status,issues:result.issues.slice(0,100),reasonCounts,
  issuesTruncated:result.issues.length>100,inspectedPairs:result.pairs,
  suppliedProofs:result.proofs,distinctDays,distinctStocks,
  reviewablePairs:matchedPairs,unverifiedOrBlockedPairs:result.pairs-matchedPairs,
  scope:"BOUNDED_SHADOW_RESEARCH_ONLY" as const,exhaustive:false as const,
  independentlyAttested:false as const,adoptionApproved:false as const,
  productionApplied:false as const,notificationEnabled:false as const};
}
