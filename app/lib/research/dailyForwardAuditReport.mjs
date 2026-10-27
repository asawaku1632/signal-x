import { verifyForwardProposalEvidence } from "./dailyForwardProposalEvidenceGate.mjs";
import { verifyForwardReviewHistoryChain } from "./dailyForwardReviewChain.mjs";

/**
 * Assemble a fail-closed, offline research audit report.
 * Requires independently pinned review-chain head. Does not persist or approve.
 */
export function buildForwardResearchAuditReport({
  researchVersion, proposals, datasetBytes, sealedReviewHistory, trustedReviewHead,
} = {}) {
  if (!Array.isArray(proposals) || !Array.isArray(sealedReviewHistory)) {
    throw new TypeError("proposals and sealedReviewHistory must be arrays");
  }
  const chain=verifyForwardReviewHistoryChain(sealedReviewHistory,trustedReviewHead);
  const reviewsById=new Map();
  for (const review of sealedReviewHistory) {
    if (review?.proposalId) reviewsById.set(review.proposalId,review);
  }
  const findings=proposals.map((proposal)=>{
    const gate=verifyForwardProposalEvidence(proposal,datasetBytes);
    const latestReview=reviewsById.get(proposal.proposalId);
    const hasHistory=Boolean(latestReview);
    const matchingReviewEvidence=Boolean(latestReview &&
      typeof proposal.evidence?.datasetSha256==="string" &&
      latestReview.evidenceSha256===proposal.evidence.datasetSha256.toLowerCase());
    const reasons=[...gate.reasons];
    if (!chain.valid) reasons.push("REVIEW_HISTORY_INTEGRITY_FAILED");
    if (!hasHistory) reasons.push("NO_REVIEW_HISTORY");
    else if (!matchingReviewEvidence) reasons.push("REVIEW_EVIDENCE_HASH_MISMATCH");
    if (latestReview && latestReview.decision!=="RESEARCH_CANDIDATE") reasons.push("LATEST_REVIEW_NOT_CANDIDATE");
    return {
      proposalId:proposal.proposalId??null,
      researchDecision:proposal.researchDecision??"HOLD",
      evidenceStatus:gate.integrity.status,
      reviewHistoryPresent:hasHistory,
      latestReviewDecision:latestReview?.decision??null,
      matchingReviewEvidence,
      status:reasons.length===0?"MANUAL_RESEARCH_REVIEW_ONLY":"AUDIT_BLOCKED",
      reasons,autoApply:false,productionWrites:false,
    };
  });
  return {
    schemaVersion:1,mode:"OFFLINE_RESEARCH_AUDIT",
    researchVersion:typeof researchVersion==="string"?researchVersion:null,
    proposalCount:proposals.length,reviewRecordCount:sealedReviewHistory.length,
    reviewChain:{valid:chain.valid,status:chain.status,issues:chain.issues,headHash:chain.headHash},
    findings,
    status:proposals.length>0 && chain.valid && findings.every((f)=>f.status==="MANUAL_RESEARCH_REVIEW_ONLY")
      ?"MANUAL_RESEARCH_REVIEW_ONLY":"AUDIT_BLOCKED",
    productionReadiness:"NOT_READY_FOR_PRODUCTION",
    autoApply:false,productionWrites:false,
    note:"Passing means integrity checks passed against caller-supplied claims and trusted reference; it does not independently prove data licensing, price basis, predictive edge, or approval.",
  };
}
