import test from "node:test";
import assert from "node:assert/strict";
import { listAuditedForwardResearchCandidates } from "../app/lib/research/dailyForwardCandidateShortlist.mjs";
const finding={proposalId:"FORWARD-10-20-39",status:"MANUAL_RESEARCH_REVIEW_ONLY",
 researchDecision:"IMPROVEMENT_CANDIDATE",latestReviewDecision:"RESEARCH_CANDIDATE",
 matchingReviewEvidence:true,evidenceStatus:"MATCH",reviewHistoryPresent:true,reasons:[]};
const report={mode:"OFFLINE_RESEARCH_AUDIT",status:"MANUAL_RESEARCH_REVIEW_ONLY",
 reviewChain:{valid:true},productionReadiness:"NOT_READY_FOR_PRODUCTION",
 autoApply:false,productionWrites:false,findings:[finding]};
test("only audit-cleared candidate enters research shortlist",()=>{
 const result=listAuditedForwardResearchCandidates(report);
 assert.equal(result.candidates.length,1);
 assert.equal(result.candidates[0].productionApproval,false);
 assert.equal(result.autoApply,false);
});
test("failed audit blocks entire shortlist",()=>{
 const result=listAuditedForwardResearchCandidates({...report,status:"AUDIT_BLOCKED"});
 assert.equal(result.status,"BLOCKED");
 assert.deepEqual(result.candidates,[]);
});
test("hold and mismatched evidence are never shortlisted",()=>{
 const result=listAuditedForwardResearchCandidates({...report,findings:[
  {...finding,latestReviewDecision:"REVIEW_HOLD"},
  {...finding,matchingReviewEvidence:false},
  {...finding,reasons:["LICENSE_UNVERIFIED"]},
 ]});
 assert.deepEqual(result.candidates,[]);
});
test("missing report or chain integrity fails closed",()=>{
 assert.equal(listAuditedForwardResearchCandidates(null).status,"BLOCKED");
 assert.equal(listAuditedForwardResearchCandidates({...report,reviewChain:{valid:false}}).status,"BLOCKED");
});
