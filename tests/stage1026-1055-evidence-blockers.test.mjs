import test from "node:test";
import assert from "node:assert/strict";
import {classifyResearchBlockers as report} from "../app/lib/learning/researchEvidenceBlockerReport.mjs";
const obs=()=>({trade_date:"2026-10-08",code:"590A",entry_price:100,ai_power:50,captured_at:"2026-10-08T07:00:00Z",return_5d:1,outcome_5d_date:"2026-10-16",provider_id:"p",license_verified:true,source_digest:"ob",signal_generated_at:"2026-10-08T06:40:00Z",bar_end_at:"2026-10-08T06:30:00Z",baseline_record_id:"b",shadow_record_id:"s",regime_provenance_id:"r"});
const row=(o,kind)=>({trade_date:o.trade_date,code:o.code,recorded_at:"2026-10-08T06:00:00Z",provider_verified:true,license_verified:true,source_digest:kind,return_5d:kind==="s"?2:1,outcome_5d_date:o.outcome_5d_date,rule_version:kind,market_regime:"UP",classified_at:"2026-10-08T06:30:00Z"});
const pair=()=>{const o=obs();return {observation:o,baseline:row(o,"b"),shadow:row(o,"s"),regime:row(o,"r")}};
test("null collection fails closed",()=>assert.equal(report(null).status,"BLOCKED"));
test("empty collection fails closed",()=>assert.equal(report([]).status,"BLOCKED"));
test("fully declared pair still blocked",()=>{const r=report([pair()]);assert.equal(r.status,"BLOCKED");assert.equal(r.reasonCounts.INDEPENDENT_ATTESTATION_REQUIRED,1)});
const cases=[
["missing observation","observation",null,"INVALID_ROW","INPUT"],
["missing baseline","baseline",null,"MISSING_BASELINE","PAIRING"],
["missing shadow","shadow",null,"MISSING_SHADOW","PAIRING"],
["missing regime","regime",null,"MISSING_REGIME","REGIME"],
["wrong baseline code","baseline",{code:"9999"},"BASELINE_KEY_MISMATCH","PAIRING"],
["wrong shadow code","shadow",{code:"9999"},"SHADOW_KEY_MISMATCH","PAIRING"],
["wrong regime code","regime",{code:"9999"},"REGIME_KEY_MISMATCH","REGIME"],
["baseline provider","baseline",{provider_verified:false},"BASELINE_PROVIDER_UNVERIFIED","PROVENANCE"],
["shadow provider","shadow",{provider_verified:false},"SHADOW_PROVIDER_UNVERIFIED","PROVENANCE"],
["regime provider","regime",{provider_verified:false},"REGIME_PROVIDER_UNVERIFIED","PROVENANCE"],
["baseline license","baseline",{license_verified:false},"BASELINE_LICENSE_UNVERIFIED","PROVENANCE"],
["shadow license","shadow",{license_verified:false},"SHADOW_LICENSE_UNVERIFIED","PROVENANCE"],
["regime license","regime",{license_verified:false},"REGIME_LICENSE_UNVERIFIED","PROVENANCE"],
["baseline digest","baseline",{source_digest:""},"BASELINE_MISSING_DIGEST","PROVENANCE"],
["shadow digest","shadow",{source_digest:""},"SHADOW_MISSING_DIGEST","PROVENANCE"],
["regime digest","regime",{source_digest:""},"REGIME_MISSING_DIGEST","PROVENANCE"],
["baseline time","baseline",{recorded_at:"2026-10-09T00:00:00Z"},"BASELINE_RECORDED_AFTER_CAPTURE","TEMPORAL"],
["shadow time","shadow",{recorded_at:"2026-10-09T00:00:00Z"},"SHADOW_RECORDED_AFTER_CAPTURE","TEMPORAL"],
["regime time","regime",{recorded_at:"2026-10-09T00:00:00Z"},"REGIME_RECORDED_AFTER_CAPTURE","TEMPORAL"],
["bad regime","regime",{market_regime:"X"},"UNVERIFIED_REGIME_LABEL","REGIME"],
["regime future","regime",{classified_at:"2026-10-09T00:00:00Z"},"REGIME_LOOKAHEAD","TEMPORAL"],
["invalid return","shadow",{return_5d:"2"},"PAIR_INVALID_RETURN","OUTCOME"],
["outcome mismatch","baseline",{outcome_5d_date:"2026-10-17"},"PAIR_OUTCOME_DATE_MISMATCH","OUTCOME"],
["shared variant","shadow",{rule_version:"b"},"PAIR_NOT_INDEPENDENT_VARIANT","INDEPENDENCE"],
["shared source","shadow",{source_digest:"b"},"PAIR_SHARED_SOURCE_REQUIRES_REVIEW","INDEPENDENCE"],
["bad price","observation",{entry_price:0},"INVALID_ENTRY_PRICE","INTEGRITY"],
["bad score","observation",{ai_power:120},"INVALID_AI_POWER","INTEGRITY"],
["lookahead bar","observation",{bar_end_at:"2026-10-08T06:59:00Z"},"LOOKAHEAD_BAR","TEMPORAL"],
["bad capture","observation",{captured_at:null},"INVALID_CAPTURE_TIMESTAMP","TEMPORAL"],
["no return","observation",{return_5d:null},"MISSING_FIVE_DAY_RETURN","OUTCOME"]
];
for(const [name,field,value,reason,group] of cases)test(name,()=>{
 const p=pair();p[field]=value===null?null:{...p[field],...value};
 const r=report([p]);assert.equal(r.status,"BLOCKED");assert.ok(r.reasonCounts[reason]>=1,name);assert.ok(r.categories[group]>=1,name);
});
test("review truncation is explicit",()=>{const r=report([pair(),pair()],{limit:1});assert.equal(r.truncated,true);assert.equal(r.reasonCounts.TRUNCATED_REVIEW,1)});
test("detail limit zero",()=>assert.equal(report([pair()],{detailLimit:0}).samples.length,0));
test("detail defaults to ten",()=>assert.equal(report(Array.from({length:20},pair)).samples.length,10));
test("detail capped at fifty",()=>assert.equal(report(Array.from({length:60},pair),{detailLimit:999}).samples.length,50));
test("bounded review",()=>assert.equal(report(Array.from({length:1001},pair),{limit:9999}).checked,1000));
test("invalid limit falls back",()=>assert.equal(report(Array.from({length:501},pair),{limit:-1}).checked,500));
test("replication never authorizes adoption",()=>assert.equal(report([pair()]).replication.status,"BLOCKED"));
