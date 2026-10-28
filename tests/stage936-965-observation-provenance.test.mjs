import test from "node:test";
import assert from "node:assert/strict";
import {auditStoredObservation,auditStoredBatch} from "../app/lib/learning/researchObservationProvenanceGate.mjs";
const good=()=>({trade_date:"2026-10-08",code:"590A",entry_price:100,ai_power:67,captured_at:"2026-10-08T07:00:00Z",return_5d:1.2,outcome_5d_date:"2026-10-16",provider_id:"provider",license_verified:true,source_digest:"digest",signal_generated_at:"2026-10-08T06:40:00Z",bar_end_at:"2026-10-08T06:30:00Z",baseline_record_id:"base",shadow_record_id:"shadow",regime_provenance_id:"regime"});
const cases=[
["null row",null,"INVALID_ROW"],
["array row",[],"INVALID_ROW"],
["invalid date",{trade_date:"2026-02-30"},"INVALID_TRADE_DATE"],
["missing date",{trade_date:null},"INVALID_TRADE_DATE"],
["numeric code",{code:1234},"INVALID_CODE"],
["short code",{code:"123"},"INVALID_CODE"],
["alphabetical suffix allowed",{code:"590A"},"INDEPENDENT_ATTESTATION_REQUIRED"],
["lowercase suffix",{code:"590a"},"INVALID_CODE"],
["zero entry",{entry_price:0},"INVALID_ENTRY_PRICE"],
["negative entry",{entry_price:-1},"INVALID_ENTRY_PRICE"],
["string entry",{entry_price:"100"},"INVALID_ENTRY_PRICE"],
["NaN entry",{entry_price:NaN},"INVALID_ENTRY_PRICE"],
["negative score",{ai_power:-0.01},"INVALID_AI_POWER"],
["score above 100",{ai_power:100.01},"INVALID_AI_POWER"],
["nonnumeric score",{ai_power:null},"INVALID_AI_POWER"],
["missing capture",{captured_at:null},"INVALID_CAPTURE_TIMESTAMP"],
["timezone-less capture",{captured_at:"2026-10-08T07:00:00"},"INVALID_CAPTURE_TIMESTAMP"],
["missing return",{return_5d:null},"MISSING_FIVE_DAY_RETURN"],
["string return",{return_5d:"1.2"},"INVALID_FIVE_DAY_RETURN"],
["infinite return",{return_5d:Infinity},"INVALID_FIVE_DAY_RETURN"],
["bad outcome day",{outcome_5d_date:"2026-10-40"},"INVALID_FIVE_DAY_DATE"],
["same day outcome",{outcome_5d_date:"2026-10-08"},"FIVE_DAY_NOT_FUTURE"],
["earlier outcome",{outcome_5d_date:"2026-10-07"},"FIVE_DAY_NOT_FUTURE"],
["no provider",{provider_id:null},"MISSING_PROVIDER_PROOF"],
["license unverified",{license_verified:false},"UNVERIFIED_LICENSE"],
["no digest",{source_digest:""},"MISSING_SOURCE_DIGEST"],
["no signal time",{signal_generated_at:null},"MISSING_SIGNAL_TIME"],
["no bar end",{bar_end_at:null},"MISSING_BAR_END_TIME"],
["bar after signal",{bar_end_at:"2026-10-08T06:50:00Z"},"LOOKAHEAD_BAR"],
["no baseline",{baseline_record_id:null},"MISSING_BASELINE_PAIR"],
["no shadow",{shadow_record_id:null},"MISSING_SHADOW_PAIR"],
["no regime",{regime_provenance_id:null},"MISSING_REGIME_PROVENANCE"],
["perfect declared input still blocked",{},"INDEPENDENT_ATTESTATION_REQUIRED"]
];
for(const [name,override,expected] of cases) test(name,()=>{
  const row=override===null||Array.isArray(override)?override:{...good(),...override};
  const result=auditStoredObservation(row);
  assert.equal(result.status,"BLOCKED");
  assert.ok(result.issues.includes(expected),name);
});
test("duplicate rows tracked",()=>{const x=auditStoredBatch([good(),good()]);assert.equal(x.reasons.DUPLICATE_OBSERVATION,1);assert.equal(x.status,"BLOCKED")});
test("bounded 1000",()=>{const x=auditStoredBatch(Array.from({length:1001},good));assert.equal(x.checked,1000);assert.equal(x.truncated,true)});
test("invalid batch blocks",()=>{assert.equal(auditStoredBatch(null).reasons.INVALID_BATCH,1)});
test("all rows blocked even when declared evidence present",()=>{assert.equal(auditStoredBatch([good()]).reasons.INDEPENDENT_ATTESTATION_REQUIRED,1)});
