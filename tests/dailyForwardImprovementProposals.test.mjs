import test from "node:test";
import assert from "node:assert/strict";
import { buildForwardResearchProposals } from "../app/lib/research/dailyForwardImprovementProposals.mjs";
const candidate={horizon:10,band:"20-39",decision:"IMPROVEMENT_CANDIDATE",reason:"DESCRIPTIVE_TREND_REPLICATED_HUMAN_REVIEW_REQUIRED"};
test("candidate proposal remains blocked from production even if source and license reviewed",()=>{
  const [p]=buildForwardResearchProposals([candidate],{sourceReview:"VERIFIED",licenseReview:"VERIFIED"});
  assert.equal(p.proposalId,"FORWARD-10-20-39");
  assert.equal(p.researchDecision,"IMPROVEMENT_CANDIDATE");
  assert.equal(p.readiness,"NOT_READY_FOR_PRODUCTION");
  assert.equal(p.autoApply,false);
  assert.equal(p.productionWrites,false);
  assert.equal(p.checks.find(x=>x.key==="LICENSE").status,"PASS");
  assert.equal(p.checks.find(x=>x.key==="HUMAN_APPROVAL").status,"REVIEW_REQUIRED");
});
test("unverified licensing and provenance remain pending",()=>{
  const [p]=buildForwardResearchProposals([candidate]);
  assert.equal(p.checks.find(x=>x.key==="LICENSE").status,"PENDING");
  assert.equal(p.checks.find(x=>x.key==="DATA_PROVENANCE").status,"PENDING");
});
test("unknown decisions fail closed to hold",()=>{
  const [p]=buildForwardResearchProposals([{horizon:5,band:"80-100",decision:"UNKNOWN"}]);
  assert.equal(p.researchDecision,"HOLD");
  assert.equal(p.evidenceReason,"MISSING_REASON");
});
test("invalid proposal input is rejected",()=>{
  assert.throws(()=>buildForwardResearchProposals(null),TypeError);
  assert.throws(()=>buildForwardResearchProposals([],{researchVersion:""}),/researchVersion/);
});
