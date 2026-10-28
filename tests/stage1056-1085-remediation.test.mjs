import test from "node:test";
import assert from "node:assert/strict";
import {planResearchRemediation as plan} from "../app/lib/learning/researchRemediationPlan.mjs";
const o=()=>({trade_date:"2026-10-08",code:"590A",entry_price:100,ai_power:50,captured_at:"2026-10-08T07:00:00Z",return_5d:1,outcome_5d_date:"2026-10-16",provider_id:"p",license_verified:true,source_digest:"o",signal_generated_at:"2026-10-08T06:40:00Z",bar_end_at:"2026-10-08T06:30:00Z",baseline_record_id:"b",shadow_record_id:"s",regime_provenance_id:"r"});
const make=(x,k)=>({trade_date:x.trade_date,code:x.code,recorded_at:"2026-10-08T06:00:00Z",provider_verified:true,license_verified:true,source_digest:k,return_5d:k==="s"?2:1,outcome_5d_date:x.outcome_5d_date,rule_version:k,market_regime:"UP",classified_at:"2026-10-08T06:30:00Z"});
const pair=()=>{const x=o();return {observation:x,baseline:make(x,"b"),shadow:make(x,"s"),regime:make(x,"r")}};
const cases=[
 ["missing observation","observation",null,"INPUT"],["missing baseline","baseline",null,"PAIRING"],["missing shadow","shadow",null,"PAIRING"],["missing regime","regime",null,"REGIME"],
 ["bad price","observation",{entry_price:0},"INTEGRITY"],["bad score","observation",{ai_power:101},"INTEGRITY"],
 ["bad return","observation",{return_5d:null},"OUTCOME"],["bad outcome","shadow",{outcome_5d_date:"2026-10-17"},"OUTCOME"],
 ["bad provider","baseline",{provider_verified:false},"PROVENANCE"],["bad license","shadow",{license_verified:false},"PROVENANCE"],["missing digest","regime",{source_digest:""},"PROVENANCE"],
 ["future baseline","baseline",{recorded_at:"2026-10-09T00:00:00Z"},"TEMPORAL"],["future shadow","shadow",{recorded_at:"2026-10-09T00:00:00Z"},"TEMPORAL"],
 ["future regime","regime",{classified_at:"2026-10-09T00:00:00Z"},"TEMPORAL"],["invalid capture","observation",{captured_at:null},"TEMPORAL"],
 ["invalid trade date","observation",{trade_date:"invalid"},"INTEGRITY"],["invalid code","observation",{code:"abc"},"INTEGRITY"],
 ["mismatched baseline","baseline",{code:"9999"},"PAIRING"],["mismatched shadow","shadow",{code:"9999"},"PAIRING"],
 ["mismatched regime","regime",{code:"9999"},"REGIME"],["bad regime","regime",{market_regime:"BOOM"},"REGIME"],
 ["same methodology","shadow",{rule_version:"b"},"INDEPENDENCE"],["same source","shadow",{source_digest:"b"},"INDEPENDENCE"],
 ["bad shadow return","shadow",{return_5d:"2"},"OUTCOME"],["unverified regime license","regime",{license_verified:false},"PROVENANCE"],
 ["invalid signal time","observation",{signal_generated_at:null},"TEMPORAL"],["bad bar end","observation",{bar_end_at:null},"TEMPORAL"],
 ["missing baseline proof","observation",{baseline_record_id:null},"PAIRING"],["missing shadow proof","observation",{shadow_record_id:null},"PAIRING"],
 ["missing regime proof","observation",{regime_provenance_id:null},"REGIME"]
];
for(const [name,field,value,category] of cases)test(name,()=>{
 const p=pair();p[field]=value===null?null:{...p[field],...value};
 const r=plan([p]);assert.equal(r.status,"BLOCKED");assert.equal(r.autoApply,false);assert.ok(r.tasks.some(x=>x.category===category),name);assert.ok(r.tasks.every(x=>!x.autoApply&&x.requiresIndependentReview));
});
test("empty input is blocked",()=>assert.equal(plan([]).adoption.eligible,false));
test("invalid collection is blocked",()=>assert.equal(plan(null).status,"BLOCKED"));
test("declared evidence still needs human review",()=>assert.ok(plan([pair()]).tasks.some(x=>x.category==="PROVENANCE")));
test("priorities are ordered",()=>{const r=plan([pair()]);assert.deepEqual(r.tasks.map(x=>x.priority),[...r.tasks.map(x=>x.priority)].sort((a,b)=>a-b))});
test("bounded result flags truncation",()=>assert.equal(plan([pair(),pair()],{limit:1}).truncated,true));
test("nothing enables notifications",()=>assert.equal(plan([pair()]).notificationsEnabled,false));
