import test from "node:test";
import assert from "node:assert/strict";
import {reconcileReadOnlyEvidence as audit} from "../app/lib/learning/researchRealEvidenceReconciliation.mjs";
const row=()=>({trade_date:"2026-10-08",code:"590A",entry_price:100,ai_power:50,captured_at:"2026-10-08T07:00:00Z",return_5d:1.2,outcome_5d_date:"2026-10-16",rule_version:"r1"});
const evidence=()=>({trade_date:"2026-10-08",code:"590A",independent_verified:true,license_verified:true,baseline_paired:true,shadow_paired:true,forward_holdout_verified:true});
test("invalid rows",()=>assert.equal(audit(null,[]).reasonCounts.INVALID_INPUT,1));
test("invalid evidence",()=>assert.equal(audit([],null).reasonCounts.INVALID_INPUT,1));
test("empty still blocked",()=>assert.equal(audit([],[]).status,"BLOCKED"));
test("matching claims not independently attested",()=>{const r=audit([row()],[evidence()]);assert.equal(r.matched,1);assert.equal(r.eligible,false);assert.equal(r.reasonCounts.EXTERNAL_ATTESTATION_NOT_ESTABLISHED,1)});
const cases=[
["missing proof",null,"MISSING_INDEPENDENT_REVIEW"],
["independence false",{independent_verified:false},"UNVERIFIED_INDEPENDENT_REVIEW"],
["license false",{license_verified:false},"UNVERIFIED_LICENSE"],
["baseline absent",{baseline_paired:false},"INCOMPLETE_PAIR"],
["shadow absent",{shadow_paired:false},"INCOMPLETE_PAIR"],
["holdout absent",{forward_holdout_verified:false},"UNVERIFIED_FORWARD_HOLDOUT"],
["independence null",{independent_verified:null},"UNVERIFIED_INDEPENDENT_REVIEW"],
["license null",{license_verified:null},"UNVERIFIED_LICENSE"],
["baseline null",{baseline_paired:null},"INCOMPLETE_PAIR"],
["shadow null",{shadow_paired:null},"INCOMPLETE_PAIR"],
["holdout null",{forward_holdout_verified:null},"UNVERIFIED_FORWARD_HOLDOUT"],
["independence string",{independent_verified:"true"},"UNVERIFIED_INDEPENDENT_REVIEW"],
["license string",{license_verified:"true"},"UNVERIFIED_LICENSE"],
["baseline string",{baseline_paired:"true"},"INCOMPLETE_PAIR"],
["shadow string",{shadow_paired:"true"},"INCOMPLETE_PAIR"],
["holdout string",{forward_holdout_verified:"true"},"UNVERIFIED_FORWARD_HOLDOUT"],
["all false",{independent_verified:false,license_verified:false,baseline_paired:false,shadow_paired:false,forward_holdout_verified:false},"EXTERNAL_ATTESTATION_NOT_ESTABLISHED"]
];
for(const [name,change,reason] of cases)test(name,()=>{const r=audit([row()],change===null?[]:[{...evidence(),...change}]);assert.equal(r.status,"BLOCKED");assert.ok(r.reasonCounts[reason]>=1,name)});
test("orphan proof",()=>{const r=audit([], [evidence()]);assert.equal(r.reasonCounts.ORPHAN_EVIDENCE,1)});
test("duplicate proof",()=>{const r=audit([row()],[evidence(),evidence()]);assert.equal(r.reasonCounts.DUPLICATE_EVIDENCE,1)});
test("mismatched proof",()=>{const r=audit([row()],[{...evidence(),code:"641A"}]);assert.equal(r.reasonCounts.MISSING_INDEPENDENT_REVIEW,1)});
test("invalid proof",()=>{const r=audit([row()],[{}]);assert.equal(r.reasonCounts.INVALID_EVIDENCE,1)});
test("null proof",()=>{const r=audit([row()],[null]);assert.equal(r.reasonCounts.INVALID_EVIDENCE,1)});
test("bad proof date",()=>{const r=audit([row()],[{...evidence(),trade_date:null}]);assert.equal(r.reasonCounts.INVALID_EVIDENCE,1)});
test("bad proof code",()=>{const r=audit([row()],[{...evidence(),code:null}]);assert.equal(r.reasonCounts.INVALID_EVIDENCE,1)});
test("truncated observations",()=>assert.equal(audit([row(),row()],[evidence()],{limit:1}).truncated,true));
test("truncated evidence",()=>assert.equal(audit([row()],[evidence(),evidence()],{limit:1}).truncated,true));
test("bounded 1000",()=>assert.equal(audit(Array.from({length:1001},row),[],{limit:9999}).checked,1000));
test("invalid limit defaults",()=>assert.equal(audit([row()],[],{limit:-1}).checked,1));
test("observed gap matrix preserved",()=>assert.ok(audit([row()],[evidence()]).dimensions.some(x=>x.dimension==="PROVENANCE")));
test("stored outcome never sufficient",()=>assert.equal(audit([row()],[]).eligible,false));
