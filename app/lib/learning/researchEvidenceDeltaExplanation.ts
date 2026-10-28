import {compareEvidenceSnapshots,type EvidenceSnapshot} from "@/app/lib/learning/researchEvidenceSnapshotDelta";
// Read-only interpretation of two comparable evidence snapshots.
// An apparent decrease in missing evidence is NOT proof of independent verification.
export function explainResearchEvidenceDelta(before:EvidenceSnapshot,after:EvidenceSnapshot){
 const result=compareEvidenceSnapshots(before,after);
 const improved=result.changes.filter(c=>c.direction==="IMPROVED");
 const worsened=result.changes.filter(c=>c.direction==="WORSENED");
 const unchanged=result.changes.filter(c=>c.direction==="UNCHANGED");
 const needsReview=result.changes.filter(c=>c.direction==="NOT_COMPARABLE");
 const status=!result.comparable?"NOT_COMPARABLE":worsened.length>0?"MIXED_OR_WORSENED":improved.length>0?"COUNTS_DECREASED_UNVERIFIED":"NO_RECORDED_CHANGE";
 return {status,scopeComparable:result.comparable,improved,worsened,unchanged,needsReview,
  baseLabel:result.baseline,currentLabel:result.current,
  independentProofOfImprovement:false as const,
  suitableForAIAdoption:false as const,ownerReviewOnly:true as const,
  productionApplied:false as const,notificationEnabled:false as const};
}
