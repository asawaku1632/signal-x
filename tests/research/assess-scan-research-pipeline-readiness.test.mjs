import test from "node:test";
import assert from "node:assert/strict";
import { assessScanResearchPipelineReadiness as assess } from "../../app/lib/learning/assessScanResearchPipelineReadiness.mjs";
const stamp="2026-10-28T06:30:00Z";
const input={scanRunId:"study-1",tradeDate:"2026-10-28",
 scanStartedAt:"2026-10-28T06:29:00Z",scanCompletedAt:"2026-10-28T06:35:00Z",
 payload:{cached:false,updatedAt:"2026-10-28T06:34:00Z",
 stocks:[{code:"590A",price:1200,aiPower:80,latestBarTimestamp:Date.parse(stamp)/1000}]}};
test("valid generated Scan is only quarantined intake, not verified research",()=>{
 const x=assess(input);
 assert.equal(x.status,"QUARANTINED_INTAKE_ONLY");
 assert.equal(x.intake.candidate_count,1);
 assert.equal(x.verified_predictions,0);
 assert.equal(x.verified_forward_results,0);
 assert.equal(x.eligible_for_live_ai,false);
 assert.equal(x.production_write_authorized,false);
});
test("evidence-shaped arrays alone cannot trigger automatic promotion",()=>{
 const x=assess(input,[{independently_verified:true}],[{return_pct:100}]);
 assert.equal(x.independent_evidence_records_supplied,1);
 assert.equal(x.forward_outcomes_supplied,1);
 assert.equal(x.verified_predictions,0);
 assert.equal(x.verified_forward_results,0);
});
test("cached source is rejected",()=>{
 const x=assess({...input,payload:{...input.payload,cached:true}});
 assert.equal(x.status,"INVALID_GENERATED_SCAN");
 assert.equal(x.intake.candidate_count,0);
});
test("missing source bar yields no candidate",()=>{
 const payload={...input.payload,stocks:[{...input.payload.stocks[0],latestBarTimestamp:null}]};
 assert.equal(assess({...input,payload}).status,"NO_INTAKE_CANDIDATES");
});
test("invalid evidence collections rejected",()=>{
 assert.throws(()=>assess(input,{},[]),/INVALID_RESEARCH_EVIDENCE_COLLECTIONS/);
});
