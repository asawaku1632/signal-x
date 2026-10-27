import test from "node:test";
import assert from "node:assert/strict";
import { hashResearchDatasetBytes } from "../app/lib/research/dailyForwardDatasetIntegrity.mjs";
import { sealForwardReviewHistory } from "../app/lib/research/dailyForwardReviewChain.mjs";
import { buildForwardResearchAuditReport } from "../app/lib/research/dailyForwardAuditReport.mjs";
const bytes=Buffer.from('{"synthetic":true}\n');
const id="FORWARD-10-20-39";
const proposal={proposalId:id,researchDecision:"IMPROVEMENT_CANDIDATE",evidence:{
  datasetSha256:hashResearchDatasetBytes(bytes),status:"TRACEABLE_METADATA_ONLY",
  priceBasisReview:"VERIFIED",licenseReview:"VERIFIED",
}};
const history=sealForwardReviewHistory([{sequence:1,proposalId:id,reviewerId:"researcher",
  reviewedAt:"2026-10-27T10:00:00Z",decision:"REVIEW_HOLD",reason:"Await independent validation",
  evidenceSha256:hashResearchDatasetBytes(bytes),productionApproval:false,autoApply:false}]);
const args={researchVersion:"offline-fixture-v1",proposals:[proposal],datasetBytes:bytes,
  sealedReviewHistory:history,trustedReviewHead:history[0].recordHash};
test("assembled report remains research-only with intact evidence and review history",()=>{
 const result=buildForwardResearchAuditReport(args);
 assert.equal(result.status,"MANUAL_RESEARCH_REVIEW_ONLY");
 assert.equal(result.findings[0].reviewHistoryPresent,true);
 assert.equal(result.autoApply,false);
 assert.equal(result.productionReadiness,"NOT_READY_FOR_PRODUCTION");
});
test("tampered dataset blocks report",()=>{
 const result=buildForwardResearchAuditReport({...args,datasetBytes:Buffer.from("tampered")});
 assert.equal(result.status,"AUDIT_BLOCKED");
 assert.ok(result.findings[0].reasons.includes("DATASET_HASH_MISMATCH"));
});
test("tampered review history blocks report",()=>{
 const changed=[{...history[0],reason:"rewritten"}];
 const result=buildForwardResearchAuditReport({...args,sealedReviewHistory:changed});
 assert.equal(result.status,"AUDIT_BLOCKED");
 assert.ok(result.findings[0].reasons.includes("REVIEW_HISTORY_INTEGRITY_FAILED"));
});
test("missing trusted chain head or history blocks report",()=>{
 assert.equal(buildForwardResearchAuditReport({...args,trustedReviewHead:null}).status,"AUDIT_BLOCKED");
 assert.equal(buildForwardResearchAuditReport({...args,sealedReviewHistory:[]}).status,"AUDIT_BLOCKED");
});
