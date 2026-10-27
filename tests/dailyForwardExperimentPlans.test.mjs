import test from "node:test";
import assert from "node:assert/strict";
import { planForwardResearchExperiments } from "../app/lib/research/dailyForwardExperimentPlans.mjs";
const shortlist={status:"RESEARCH_SHORTLIST",autoApply:false,productionWrites:false,
 candidates:[{proposalId:"FORWARD-10-20-39",status:"RESEARCH_REVIEW_CANDIDATE",
 productionApproval:false,autoApply:false}]};
const config={baselineVersion:"baseline-frozen-1",proposedVersion:"experiment-frozen-2",
 holdoutStart:"2026-11-01",holdoutEnd:"2027-01-31"};
test("eligible candidate produces design only, never AI deployment",()=>{
 const result=planForwardResearchExperiments(shortlist,config);
 assert.equal(result.status,"EXPERIMENT_DESIGNS_ONLY");
 assert.equal(result.plans.length,1);
 assert.equal(result.plans[0].status,"DESIGN_ONLY_NOT_EXECUTED");
 assert.equal(result.plans[0].productionApproval,false);
 assert.equal(result.autoApply,false);
});
test("unapproved shortlist cannot create experiment plans",()=>{
 assert.equal(planForwardResearchExperiments({...shortlist,status:"BLOCKED"},config).status,"BLOCKED");
 assert.equal(planForwardResearchExperiments(null,config).plans.length,0);
});
test("missing comparison versions or invalid holdout blocks planning",()=>{
 assert.equal(planForwardResearchExperiments(shortlist,{...config,proposedVersion:config.baselineVersion}).status,"BLOCKED");
 assert.equal(planForwardResearchExperiments(shortlist,{...config,holdoutEnd:"2026-10-01"}).status,"BLOCKED");
});
test("invalid sample threshold blocks planning",()=>{
 assert.equal(planForwardResearchExperiments(shortlist,{...config,minVerifiedSamples:2}).status,"BLOCKED");
});
