import test from "node:test";
import assert from "node:assert/strict";
import { assessAiPowerImprovementEvidence as assess } from "../../app/lib/learning/assessAiPowerImprovementEvidence.mjs";
test("zero data reports explicit blocked improvement gates",()=>{
 const x=assess([],[]);
 assert.equal(x.status,"NOT_READY_FOR_HUMAN_EFFECT_REVIEW");
 assert.equal(x.coverage.verified_outcomes,0);
 assert.ok(x.reasons.includes("NO_INDEPENDENTLY_VERIFIED_FORWARD_RESULTS"));
 assert.equal(x.eligible_for_live_ai,false);
 assert.equal(x.effect_established,false);
 assert.equal(x.automatic_learning_allowed,false);
});
test("quarantined records cannot satisfy AI POWER learning coverage",()=>{
 const x=assess([{scan_run_id:"test",code:"9984",capture_status:"QUARANTINED",ai_power:90}],[]);
 assert.equal(x.coverage.verified_outcomes,0);
 assert.equal(x.automatic_learning_allowed,false);
});
test("malformed research collections fail closed",()=>{
 assert.throws(()=>assess(null,[]),/INVALID_RESEARCH_INPUT/);
});
