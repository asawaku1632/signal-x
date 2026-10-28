import {getSwingResearchReviewSnapshot} from "@/app/lib/learning/swingResearchReviewSnapshot";
import pool from "@/app/lib/postgres";
import {inspectEvidenceEnvelope} from "@/app/lib/learning/researchEvidenceEnvelope";
import {reconcileResearchEvidence,type StoredProofRow} from "@/app/lib/learning/researchEvidenceReconciliation";
// Read only; route MUST check learning-owner authorization first.
// Limited query, exact fixed research scope and no silent claim of verified provenance.
export async function getIntegratedResearchReview(now=new Date()){
 const snapshot=await getSwingResearchReviewSnapshot();
 const e=snapshot.evidence;
 const rows=await pool.query<{digest:string;envelope:unknown;recorded_at:Date|string}>(
  "SELECT digest,envelope,recorded_at FROM public.research_evidence_envelopes WHERE research_id=$1 AND rule_version=$2 ORDER BY recorded_at DESC,id DESC LIMIT 50",
  [e.researchId,e.ruleVersion]);
 const items:StoredProofRow[]=rows.rows.map(r=>{
  const result=inspectEvidenceEnvelope(r.envelope,now.toISOString());
  return {digest:r.digest,envelope:r.envelope,recordedAt:r.recorded_at,
   valid:result.valid&&result.digest===r.digest,issues:result.issues};
 });
 const evaluation=reconcileResearchEvidence(e,items,now.toISOString());
 // A bounded snapshot cannot prove an exhaustive history. Review status must
 // remain BLOCKED until completeness and independent source audit exist.
 const truncated=items.length===50;
 return {source:"READ_ONLY_RESEARCH_EVIDENCE_JOIN" as const,
  researchId:e.researchId,ruleVersion:e.ruleVersion,
  recorded:e.recorded,evaluated:e.evaluated,
  historyCount:items.length,historyTruncated:truncated,
  status:"BLOCKED" as const,reviewCandidateOnSample:evaluation.evidenceReady,
  reasons:[...evaluation.issues,...(truncated?["HISTORY_MAY_BE_TRUNCATED"]:[]),
   "INDEPENDENT_PROVENANCE_AND_HISTORY_COMPLETENESS_NOT_ATTESTED"],
  entries:evaluation.entries.map(x=>({digest:x.digest,valid:x.valid,issues:x.issues})),
  ownerReviewOnly:true as const,approvalRecorded:false as const,
  productionApplied:false as const,notificationEnabled:false as const};
}
