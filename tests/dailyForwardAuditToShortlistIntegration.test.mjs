import test from "node:test";
import assert from "node:assert/strict";
import { hashResearchDatasetBytes } from "../app/lib/research/dailyForwardDatasetIntegrity.mjs";
import { sealForwardReviewHistory } from "../app/lib/research/dailyForwardReviewChain.mjs";
import { buildForwardResearchAuditReport } from "../app/lib/research/dailyForwardAuditReport.mjs";
import { listAuditedForwardResearchCandidates } from "../app/lib/research/dailyForwardCandidateShortlist.mjs";

const dataset=Buffer.from('{"fixture":"offline-end-to-end"}\n');
const digest=hashResearchDatasetBytes(dataset);
const proposal={proposalId:"FORWARD-5-65-79",researchDecision:"IMPROVEMENT_CANDIDATE",
 evidence:{datasetSha256:digest,status:"TRACEABLE_METADATA_ONLY",
 priceBasisReview:"VERIFIED",licenseReview:"VERIFIED"}};
function reportWith(decision="RESEARCH_CANDIDATE",reviewHash=digest,bytes=dataset) {
 const sealedReviewHistory=sealForwardReviewHistory([{
  sequence:1,proposalId:proposal.proposalId,reviewerId:"offline-test-reviewer",
  reviewedAt:"2026-10-27T11:00:00Z",decision,
  reason:"Synthetic end-to-end test only",evidenceSha256:reviewHash,
  productionApproval:false,autoApply:false,
 }]);
 return buildForwardResearchAuditReport({
  researchVersion:"synthetic-test-only",proposals:[proposal],
  datasetBytes:bytes,sealedReviewHistory,
  trustedReviewHead:sealedReviewHistory[0].recordHash,
 });
}
test("real audit builder feeds candidate shortlist, never production",()=>{
 const report=reportWith();
 const result=listAuditedForwardResearchCandidates(report);
 assert.equal(report.status,"MANUAL_RESEARCH_REVIEW_ONLY");
 assert.deepEqual(result.candidates.map(c=>c.proposalId),[proposal.proposalId]);
 assert.equal(result.autoApply,false);
 assert.equal(result.productionWrites,false);
});
test("hold review is excluded across actual audit-to-shortlist pipeline",()=>{
 const result=listAuditedForwardResearchCandidates(reportWith("REVIEW_HOLD"));
 assert.deepEqual(result.candidates,[]);
});
test("review referring to different dataset is blocked end to end",()=>{
 const result=listAuditedForwardResearchCandidates(reportWith("RESEARCH_CANDIDATE","b".repeat(64)));
 assert.equal(result.status,"BLOCKED");
 assert.deepEqual(result.candidates,[]);
});
test("tampered dataset is blocked end to end",()=>{
 const result=listAuditedForwardResearchCandidates(reportWith("RESEARCH_CANDIDATE",digest,Buffer.from("modified")));
 assert.equal(result.status,"BLOCKED");
 assert.deepEqual(result.candidates,[]);
});
