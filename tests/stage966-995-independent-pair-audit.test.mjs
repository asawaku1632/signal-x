import test from "node:test";
import assert from "node:assert/strict";
import {inspectEvidencePair,inspectEvidencePairs} from "../app/lib/learning/researchIndependentPairAudit.mjs";
const obs=()=>({trade_date:"2026-10-08",code:"590A",entry_price:100,ai_power:55,captured_at:"2026-10-08T07:00:00Z",return_5d:1,outcome_5d_date:"2026-10-16",provider_id:"p",license_verified:true,source_digest:"o",signal_generated_at:"2026-10-08T06:40:00Z",bar_end_at:"2026-10-08T06:30:00Z",baseline_record_id:"b",shadow_record_id:"s",regime_provenance_id:"r"});
const base=()=>({trade_date:"2026-10-08",code:"590A",recorded_at:"2026-10-08T06:00:00Z",provider_verified:true,license_verified:true,source_digest:"base",return_5d:1,outcome_5d_date:"2026-10-16",rule_version:"control"});
const shadow=()=>({...base(),source_digest:"shadow",rule_version:"candidate",return_5d:2});
const regime=()=>({...base(),source_digest:"regime",market_regime:"UP",classified_at:"2026-10-08T06:30:00Z"});
const pairs=()=>[obs(),base(),shadow(),regime()];
const cases=[
["missing observation",0,null,"INVALID_ROW"],
["missing baseline",1,null,"MISSING_BASELINE"],
["missing shadow",2,null,"MISSING_SHADOW"],
["missing regime",3,null,"MISSING_REGIME"],
["baseline mismatch",1,{code:"1111"},"BASELINE_KEY_MISMATCH"],
["shadow mismatch",2,{trade_date:"2026-10-09"},"SHADOW_KEY_MISMATCH"],
["regime mismatch",3,{code:"9999"},"REGIME_KEY_MISMATCH"],
["baseline invalid date",1,{trade_date:"2026-02-30"},"BASELINE_INVALID_DATE"],
["shadow invalid date",2,{trade_date:"garbage"},"SHADOW_INVALID_DATE"],
["regime invalid date",3,{trade_date:"2026-11-31"},"REGIME_INVALID_DATE"],
["baseline missing timestamp",1,{recorded_at:null},"BASELINE_INVALID_RECORDED_AT"],
["shadow time future",2,{recorded_at:"2026-10-09T06:00:00Z"},"SHADOW_RECORDED_AFTER_CAPTURE"],
["regime time future",3,{recorded_at:"2026-10-09T06:00:00Z"},"REGIME_RECORDED_AFTER_CAPTURE"],
["baseline provider",1,{provider_verified:false},"BASELINE_PROVIDER_UNVERIFIED"],
["shadow provider",2,{provider_verified:false},"SHADOW_PROVIDER_UNVERIFIED"],
["regime provider",3,{provider_verified:false},"REGIME_PROVIDER_UNVERIFIED"],
["baseline license",1,{license_verified:false},"BASELINE_LICENSE_UNVERIFIED"],
["shadow license",2,{license_verified:false},"SHADOW_LICENSE_UNVERIFIED"],
["regime license",3,{license_verified:false},"REGIME_LICENSE_UNVERIFIED"],
["baseline digest",1,{source_digest:""},"BASELINE_MISSING_DIGEST"],
["shadow digest",2,{source_digest:""},"SHADOW_MISSING_DIGEST"],
["regime digest",3,{source_digest:""},"REGIME_MISSING_DIGEST"],
["baseline nonnumeric result",1,{return_5d:"1"},"PAIR_INVALID_RETURN"],
["shadow nonnumeric result",2,{return_5d:Infinity},"PAIR_INVALID_RETURN"],
["baseline wrong outcome date",1,{outcome_5d_date:"2026-10-17"},"PAIR_OUTCOME_DATE_MISMATCH"],
["shadow wrong outcome date",2,{outcome_5d_date:"2026-10-17"},"PAIR_OUTCOME_DATE_MISMATCH"],
["shared rule",2,{rule_version:"control"},"PAIR_NOT_INDEPENDENT_VARIANT"],
["shared digest",2,{source_digest:"base"},"PAIR_SHARED_SOURCE_REQUIRES_REVIEW"],
["unknown regime",3,{market_regime:"CRASH"},"UNVERIFIED_REGIME_LABEL"],
["regime classified later",3,{classified_at:"2026-10-09T00:00:00Z"},"REGIME_LOOKAHEAD"]
];
for(const [label,idx,replace,reason] of cases) test(label,()=>{
 const p=pairs();
 p[idx]=replace===null?null:{...p[idx],...replace};
 const v=inspectEvidencePair(...p);
 assert.equal(v.status,"BLOCKED");
 assert.ok(v.issues.includes(reason),label+" "+JSON.stringify(v.issues));
});
test("valid declared input still BLOCKED",()=>{const r=inspectEvidencePair(...pairs()); assert.deepEqual(r.issues,["INDEPENDENT_ATTESTATION_REQUIRED"]);assert.equal(r.status,"BLOCKED")});
test("missing arrays",()=>{assert.equal(inspectEvidencePairs(null,[],[],[]).reasons.INVALID_COLLECTION,1)});
test("duplicate baseline",()=>{const p=pairs();assert.equal(inspectEvidencePairs([p[0]],[p[1],p[1]],[p[2]],[p[3]]).reasons.BASELINE_DUPLICATE,1)});
test("duplicate observation",()=>{const p=pairs();assert.equal(inspectEvidencePairs([p[0],p[0]],[p[1]],[p[2]],[p[3]]).reasons.DUPLICATE_OBSERVATION,1)});
test("orphan shadow",()=>{const p=pairs();assert.equal(inspectEvidencePairs([p[0]],[p[1]],[{...p[2],code:"2222"}],[p[3]]).reasons.SHADOW_ORPHAN,1)});
test("orphan baseline",()=>{const p=pairs();assert.equal(inspectEvidencePairs([p[0]],[{...p[1],code:"2222"}],[p[2]],[p[3]]).reasons.BASELINE_ORPHAN,1)});
test("orphan regime",()=>{const p=pairs();assert.equal(inspectEvidencePairs([p[0]],[p[1]],[p[2]],[{...p[3],code:"2222"}]).reasons.REGIME_ORPHAN,1)});
test("truncated evidence never approved",()=>{const p=pairs();const r=inspectEvidencePairs([p[0],p[0]],[p[1]],[p[2]],[p[3]],1);assert.equal(r.truncated,true);assert.equal(r.reasons.TRUNCATED_INPUT,1);assert.equal(r.status,"BLOCKED")});
test("invalid pair row",()=>{const p=pairs();assert.equal(inspectEvidencePairs([p[0]],[null],[p[2]],[p[3]]).reasons.BASELINE_INVALID_ROW,1)});
test("all reasons remain blocked",()=>{const p=pairs();assert.equal(inspectEvidencePairs([p[0]],[p[1]],[p[2]],[p[3]]).status,"BLOCKED")});
