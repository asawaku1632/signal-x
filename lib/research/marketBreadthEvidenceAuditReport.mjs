// Offline audit aggregation. This reports process coverage, never real-world verification.
import {preflightMarketBreadthProspectiveForward} from './marketBreadthProspectiveForwardGate.mjs';
import {reviewMarketBreadthSignedEvidenceBatch} from './marketBreadthSignedEvidenceBatch.mjs';
const countReasons=items=>Object.fromEntries([...items.reduce((m,item)=>(m.set(item.reason,(m.get(item.reason)??0)+1),m),new Map())].sort(([a],[b])=>a.localeCompare(b)));
export function buildMarketBreadthEvidenceAuditReport({prospectiveEntries=[],signedEvidenceEntries=[],trustedPublicKeyPem,trustedKeyFingerprint}={}){
 const prospective=preflightMarketBreadthProspectiveForward(prospectiveEntries);
 const signed=reviewMarketBreadthSignedEvidenceBatch(signedEvidenceEntries,{trustedPublicKeyPem,trustedKeyFingerprint});
 const prospectiveIds=new Set(prospective.candidates.map(x=>x.signalRecordId));
 const matched=signed.accepted.filter(x=>prospectiveIds.has(x.signalRecordId));
 const unmatched=signed.accepted.filter(x=>!prospectiveIds.has(x.signalRecordId));
 return {schemaVersion:'market-breadth-evidence-audit-v1',researchOnly:true,productionEligible:false,notificationEligible:false,independentlyVerifiedCount:0,
  counts:{submittedProspective:prospective.submittedCount,preflightAccepted:prospective.preflightCandidateCount,preflightRejected:prospective.rejectedCount,submittedSignedEvidence:signed.signatureBoundCount+signed.rejectedCount,signatureBound:signed.signatureBoundCount,signedRejected:signed.rejectedCount,internallyMatched:matched.length,unmatchedSignedEvidence:unmatched.length},
  reasons:{prospective:countReasons(prospective.rejected),signed:countReasons(signed.rejected)},
  blockers:['INDEPENDENT_AUDITOR_AUTHORITY_NOT_ESTABLISHED','PROVIDER_LICENSE_NOT_INDEPENDENTLY_VERIFIED','FIVE_SESSION_OUTCOME_NOT_INDEPENDENTLY_AUDITED'],
  matchedSignalIds:matched.map(x=>x.signalRecordId).sort(),unmatchedSignalIds:unmatched.map(x=>x.signalRecordId).sort()};
}
