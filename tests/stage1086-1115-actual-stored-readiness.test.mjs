import test from "node:test";
import assert from "node:assert/strict";
import {inspectActualStoredObservation as inspect,summarizeActualStoredObservations as summary} from "../app/lib/learning/researchActualStoredReadiness.mjs";
const row=()=>({trade_date:"2026-10-08",code:"590A",entry_price:100,ai_power:55,captured_at:"2026-10-08T07:00:00Z",return_5d:1.2,outcome_5d_date:"2026-10-16",rule_version:"r1"});
const cases=[
["null",null,"INVALID_ROW"],["array",[],"INVALID_ROW"],
["bad date",{trade_date:"2026-02-30"},"INVALID_TRADE_DATE"],
["missing date",{trade_date:null},"INVALID_TRADE_DATE"],
["bad code",{code:"123"},"INVALID_CODE"],
["numeric code",{code:1234},"INVALID_CODE"],
["lowercase code",{code:"590a"},"INVALID_CODE"],
["zero price",{entry_price:0},"INVALID_ENTRY"],
["negative price",{entry_price:-1},"INVALID_ENTRY"],
["string price",{entry_price:"100"},"INVALID_ENTRY"],
["infinite price",{entry_price:Infinity},"INVALID_ENTRY"],
["negative ai",{ai_power:-1},"INVALID_AI_POWER"],
["high ai",{ai_power:101},"INVALID_AI_POWER"],
["string ai",{ai_power:"55"},"INVALID_AI_POWER"],
["missing capture",{captured_at:null},"INVALID_CAPTURE_TIME"],
["local capture",{captured_at:"2026-10-08T07:00:00"},"INVALID_CAPTURE_TIME"],
["missing return",{return_5d:null},"PENDING_FIVE_DAY_OUTCOME"],
["string return",{return_5d:"1.2"},"INVALID_FIVE_DAY_OUTCOME"],
["infinite return",{return_5d:Infinity},"INVALID_FIVE_DAY_OUTCOME"],
["return missing outcome day",{outcome_5d_date:null},"MISSING_FIVE_DAY_DATE"],
["outcome same day",{outcome_5d_date:"2026-10-08"},"INVALID_FIVE_DAY_DATE"],
["outcome earlier",{outcome_5d_date:"2026-10-07"},"INVALID_FIVE_DAY_DATE"],
["outcome bogus",{outcome_5d_date:"2026-02-30"},"INVALID_FIVE_DAY_DATE"],
["missing rule",{rule_version:null},"MISSING_RULE_VERSION"],
["empty rule",{rule_version:""},"MISSING_RULE_VERSION"],
["valid stored outcome still blocked",{},"OUT_OF_SAMPLE_REPLICATION_NOT_ATTESTED"],
["missing source proof",{},"INDEPENDENT_PROVIDER_LICENSE_PROOF_ABSENT"],
["missing signal provenance",{},"SIGNAL_BAR_PROVENANCE_ABSENT"],
["missing shadow pairing",{},"BASELINE_SHADOW_PAIR_ABSENT"],
["missing regime provenance",{},"MARKET_REGIME_PROVENANCE_ABSENT"]
];
for(const [label,override,reason] of cases)test(label,()=>{const r=inspect(override===null||Array.isArray(override)?override:{...row(),...override});assert.equal(r.status,"BLOCKED");assert.ok(r.reasons.includes(reason),label)});
test("one completed outcome but not production eligible",()=>{const r=summary([row()]);assert.equal(r.completedFiveDay,1);assert.equal(r.productionEligible,false)});
test("pending outcome excluded",()=>{const r=summary([{...row(),return_5d:null,outcome_5d_date:null}]);assert.equal(r.completedFiveDay,0)});
test("duplicate observed",()=>assert.equal(summary([row(),row()]).reasonCounts.DUPLICATE_OBSERVATION,1));
test("distinct days",()=>assert.equal(summary([row(),{...row(),trade_date:"2026-10-09"}]).distinctDays,2));
test("distinct stocks",()=>assert.equal(summary([row(),{...row(),code:"641A"}]).distinctStocks,2));
test("review truncated",()=>{const r=summary([row(),row()],{limit:1});assert.equal(r.truncated,true);assert.equal(r.reasonCounts.TRUNCATED_READ,1)});
test("max 1000 records",()=>assert.equal(summary(Array.from({length:1001},row),{limit:9999}).checked,1000));
test("bad input",()=>assert.equal(summary(null).reasonCounts.INVALID_BATCH,1));
test("invalid limit defaults",()=>assert.equal(summary(Array.from({length:501},row),{limit:-1}).checked,1000-0<501?1000:501));
