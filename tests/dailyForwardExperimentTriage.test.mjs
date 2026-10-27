import test from "node:test";
import assert from "node:assert/strict";
import { triageForwardExperimentEvidence } from "../app/lib/research/dailyForwardExperimentTriage.mjs";
const comparison={status:"DESCRIPTIVE_COMPARISON_ONLY",improvementProven:false,
 autoApply:false,averageDifferencePctPoints:1};
const uncertainty={status:"DESCRIPTIVE_DIAGNOSTICS_ONLY",improvementProven:false,
 autoApply:false,distinctDates:25};
const risk={status:"DESCRIPTIVE_RISK_ONLY",improvementProven:false,
 autoApply:false,maxDrawdownPct:5};
test("cleared descriptive checks only permit independent research review",()=>{
 const result=triageForwardExperimentEvidence({comparison,uncertainty,risk});
 assert.equal(result.status,"ELIGIBLE_FOR_INDEPENDENT_RESEARCH_REVIEW");
 assert.equal(result.improvementProven,false);
 assert.equal(result.productionApproval,false);
 assert.equal(result.autoApply,false);
});
test("missing or blocked risk holds research",()=>{
 const result=triageForwardExperimentEvidence({comparison,uncertainty,risk:{...risk,status:"RISK_REVIEW_BLOCKED"}});
 assert.equal(result.status,"HOLD_FOR_MORE_RESEARCH");
 assert.ok(result.reasons.includes("RISK_NOT_CLEARED"));
});
test("negative or zero difference does not advance",()=>{
 const result=triageForwardExperimentEvidence({comparison:{...comparison,averageDifferencePctPoints:0},uncertainty,risk});
 assert.ok(result.reasons.includes("NO_POSITIVE_DESCRIPTIVE_DIFFERENCE"));
});
test("insufficient distinct dates blocks advancement",()=>{
 const result=triageForwardExperimentEvidence({comparison,uncertainty:{...uncertainty,distinctDates:2},risk});
 assert.ok(result.reasons.includes("INSUFFICIENT_INDEPENDENT_DATES"));
});
test("empty or invalid inputs fail closed",()=>{
 assert.equal(triageForwardExperimentEvidence().status,"HOLD_FOR_MORE_RESEARCH");
 assert.ok(triageForwardExperimentEvidence({comparison:{...comparison,autoApply:true},uncertainty,risk}).reasons.includes("AUTOMATION_NOT_DISABLED"));
});
