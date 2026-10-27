import { verifyResearchDatasetBytes } from "./dailyForwardDatasetIntegrity.mjs";

/**
 * Offline evidence gate. Integrity is necessary, not sufficient, for review.
 * No production changes, model updates, or implicit license approvals.
 */
export function verifyForwardProposalEvidence(proposal, datasetBytes) {
  if (!proposal || typeof proposal !== "object") throw new TypeError("proposal required");
  const expected=proposal.evidence?.datasetSha256;
  const integrity=verifyResearchDatasetBytes(datasetBytes,expected);
  const metadataComplete=proposal.evidence?.status==="TRACEABLE_METADATA_ONLY";
  const basisVerified=proposal.evidence?.priceBasisReview==="VERIFIED";
  const licenseVerified=proposal.evidence?.licenseReview==="VERIFIED";
  const candidate=proposal.researchDecision==="IMPROVEMENT_CANDIDATE";
  const reasons=[];
  if (!integrity.matches) reasons.push("DATASET_HASH_MISMATCH");
  if (!metadataComplete) reasons.push("EVIDENCE_METADATA_INCOMPLETE");
  if (!basisVerified) reasons.push("PRICE_BASIS_UNVERIFIED");
  if (!licenseVerified) reasons.push("LICENSE_UNVERIFIED");
  if (!candidate) reasons.push("NOT_AN_IMPROVEMENT_CANDIDATE");
  return {
    proposalId:proposal.proposalId??null,
    status:reasons.length===0?"READY_FOR_MANUAL_RESEARCH_REVIEW":"REVIEW_BLOCKED",
    reasons,integrity,
    autoApply:false,productionWrites:false,
    readiness:"NOT_READY_FOR_PRODUCTION",
    note:"Even a passing integrity gate does not establish independent replication, profitability, or production approval.",
  };
}
