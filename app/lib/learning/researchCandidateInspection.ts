import {verifyResearchProofs,type EvidenceProof} from "@/app/lib/learning/researchEvidenceLedger";
import {assessResearchEvidence,type EvidenceSnapshot} from "@/app/lib/learning/researchApprovalGate";
// Independent proof verification is additional to the original eligibility gate.
// Never infer the underlying audit flags from a submitted assertion alone.
export function inspectResearchCandidate(e:EvidenceSnapshot,proofs:EvidenceProof[],now:string){
 const eligibility=assessResearchEvidence(e);
 const ledger=verifyResearchProofs(e.researchId,e.ruleVersion,proofs,now);
 return {status:eligibility.eligibleForHumanReview&&ledger.verified?"EVIDENCE_READY_FOR_HUMAN_REVIEW":"BLOCKED",
  issues:[...eligibility.reasons,...ledger.issues],evidenceDigest:ledger.digest,
  proofCount:ledger.proofCount,approvalRecorded:false as const,productionApplied:false as const,
  notificationEnabled:false as const,automaticActivation:false as const};
}
