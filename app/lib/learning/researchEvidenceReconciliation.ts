import {inspectEvidenceEnvelope} from "@/app/lib/learning/researchEvidenceEnvelope";
import {assessResearchEvidence,type EvidenceSnapshot} from "@/app/lib/learning/researchApprovalGate";
export type StoredProofRow={digest:string;envelope:unknown;recordedAt:string|Date;valid:boolean;issues:string[]};
export function reconcileResearchEvidence(e:EvidenceSnapshot,rows:StoredProofRow[],now:string){
 const gate=assessResearchEvidence(e);
 const entries=rows.map(row=>{
  const inspected=inspectEvidenceEnvelope(row.envelope,now);
  const payload=row.envelope as {researchId?:unknown;ruleVersion?:unknown}|null;
  const scopeMatches=payload?.researchId===e.researchId&&payload?.ruleVersion===e.ruleVersion;
  const digestMatches=inspected.digest===row.digest;
  const valid=Boolean(row.valid&&inspected.valid&&scopeMatches&&digestMatches);
  return {digest:row.digest,valid,issues:[...row.issues,...inspected.issues,...(!scopeMatches?["RESEARCH_SCOPE_MISMATCH"]:[]),...(!digestMatches?["STORED_DIGEST_MISMATCH"]:[])]};
 });
 const validRecords=entries.filter(x=>x.valid).length;
 // Multiple valid conflicting envelopes are ambiguous, never select one by recency.
 const distinctValidDigests=new Set(entries.filter(x=>x.valid).map(x=>x.digest));
 const ambiguous=distinctValidDigests.size>1;
 const evidenceReady=gate.eligibleForHumanReview&&distinctValidDigests.size===1;
 return {status:evidenceReady?"EVIDENCE_READY_FOR_HUMAN_REVIEW":"BLOCKED",
  evidenceReady,gateReasons:gate.reasons,entries,validRecords,ambiguous,
  issues:[...gate.reasons,...(validRecords===0?["NO_VERIFIED_EVIDENCE"]:[]),...(ambiguous?["CONFLICTING_VERIFIED_EVIDENCE"]:[])],
  approvalRecorded:false as const,productionApplied:false as const,notificationEnabled:false as const};
}
