import test from "node:test";
import assert from "node:assert/strict";
import { describeVerifiedAiPowerBands } from "../../app/lib/learning/describeVerifiedAiPowerBands.mjs";
test("empty evidence yields no verified win-rate or live threshold",()=>{
 const x=describeVerifiedAiPowerBands([],[]);
 assert.equal(x.status,"NO_INDEPENDENTLY_VERIFIED_OUTCOMES");
 assert.equal(x.accepted_count,0);
 assert.equal(x.bands.length,4);
 assert.ok(x.bands.every(b=>b.positive_rate_pct===null && b.mean_return_pct===null));
 assert.equal(x.eligible_for_live_ai,false);
});
test("quarantined examples cannot become validated AI POWER calibration",()=>{
 const x=describeVerifiedAiPowerBands([{scan_run_id:"test",code:"9984",capture_status:"QUARANTINED",ai_power:95}],[]);
 assert.equal(x.accepted_count,0);
 assert.equal(x.rejected[0].reason,"UNVERIFIED_CAPTURE");
 assert.equal(x.threshold_change_authorized,false);
});
test("rejects malformed source collections",()=>{
 assert.throws(()=>describeVerifiedAiPowerBands(null,[]),/INVALID_RESEARCH_INPUT/);
});
