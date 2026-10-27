import test from "node:test";
import assert from "node:assert/strict";
import { hashResearchDatasetBytes } from "../app/lib/research/dailyForwardDatasetIntegrity.mjs";
import { verifyForwardProposalEvidence } from "../app/lib/research/dailyForwardProposalEvidenceGate.mjs";
const bytes=Buffer.from('{"data":"offline synthetic fixture"}\n');
const proposal={
  proposalId:"FORWARD-10-20-39",
  researchDecision:"IMPROVEMENT_CANDIDATE",
  evidence:{datasetSha256:hashResearchDatasetBytes(bytes),status:"TRACEABLE_METADATA_ONLY",
    priceBasisReview:"VERIFIED",licenseReview:"VERIFIED"},
};
test("matching trusted bytes permit manual research review only",()=>{
  const result=verifyForwardProposalEvidence(proposal,bytes);
  assert.equal(result.status,"READY_FOR_MANUAL_RESEARCH_REVIEW");
  assert.equal(result.autoApply,false);
  assert.equal(result.readiness,"NOT_READY_FOR_PRODUCTION");
});
test("altered dataset blocks review",()=>{
  const result=verifyForwardProposalEvidence(proposal,Buffer.from('{"data":"changed"}\n'));
  assert.equal(result.status,"REVIEW_BLOCKED");
  assert.ok(result.reasons.includes("DATASET_HASH_MISMATCH"));
});
test("missing license, price basis, or incomplete metadata blocks review",()=>{
  const result=verifyForwardProposalEvidence({...proposal,evidence:{...proposal.evidence,licenseReview:"NOT_VERIFIED",priceBasisReview:"NOT_VERIFIED",status:"INCOMPLETE_METADATA"}},bytes);
  assert.equal(result.status,"REVIEW_BLOCKED");
  assert.ok(result.reasons.includes("LICENSE_UNVERIFIED"));
  assert.ok(result.reasons.includes("PRICE_BASIS_UNVERIFIED"));
});
test("non-candidate cannot be advanced",()=>{
  const result=verifyForwardProposalEvidence({...proposal,researchDecision:"HOLD"},bytes);
  assert.equal(result.status,"REVIEW_BLOCKED");
});
