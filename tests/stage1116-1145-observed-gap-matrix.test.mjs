import test from "node:test";
import assert from "node:assert/strict";
import {inspectStoredGapMatrix as inspect} from "../app/lib/learning/researchObservedGapMatrix.mjs";
const good=()=>({trade_date:"2026-10-08",code:"590A",entry_price:100,ai_power:55,captured_at:"2026-10-08T07:00:00Z",return_5d:1.2,outcome_5d_date:"2026-10-16",rule_version:"r1"});
const cases=[
["empty",[],null,"PROVENANCE"],["single",[good()],null,"PROVENANCE"],
["missing result",[good()],{return_5d:null},"OUTCOME"],
["bad result",[good()],{return_5d:"1"},"OUTCOME"],
["missing date",[good()],{outcome_5d_date:null},"OUTCOME"],
["same date",[good()],{outcome_5d_date:"2026-10-08"},"OUTCOME"],
["invalid trade date",[good()],{trade_date:"bad"},"INTEGRITY"],
["invalid code",[good()],{code:"a"},"INTEGRITY"],
["invalid price",[good()],{entry_price:0},"INTEGRITY"],
["invalid score",[good()],{ai_power:101},"INTEGRITY"],
["invalid timestamp",[good()],{captured_at:null},"INTEGRITY"],
["invalid rule",[good()],{rule_version:""},"INTEGRITY"],
["negative price",[good()],{entry_price:-1},"INTEGRITY"],
["infinite score",[good()],{ai_power:Infinity},"INTEGRITY"],
["numeric code",[good()],{code:1234},"INTEGRITY"],
["invalid date",[good()],{trade_date:"2026-02-30"},"INTEGRITY"],
["invalid outcome date",[good()],{outcome_5d_date:"invalid"},"OUTCOME"],
["earlier outcome date",[good()],{outcome_5d_date:"2026-10-01"},"OUTCOME"],
["zero price",[good()],{entry_price:0},"INTEGRITY"],
["negative AI",[good()],{ai_power:-1},"INTEGRITY"],
["string AI",[good()],{ai_power:"50"},"INTEGRITY"],
["string entry",[good()],{entry_price:"100"},"INTEGRITY"],
["future outcome absent",[good()],{return_5d:null,outcome_5d_date:null},"OUTCOME"],
["no capture timezone",[good()],{captured_at:"2026-10-08T07:00:00"},"INTEGRITY"],
["missing rule version",[good()],{rule_version:null},"INTEGRITY"],
["missing code",[good()],{code:null},"INTEGRITY"],
["missing entry",[good()],{entry_price:null},"INTEGRITY"],
["missing AI",[good()],{ai_power:null},"INTEGRITY"],
["invalid outcome Infinity",[good()],{return_5d:Infinity},"OUTCOME"],
["invalid outcome NaN",[good()],{return_5d:NaN},"OUTCOME"]
];
for(const [label,arr,patch,dimension] of cases)test(label,()=>{
 const rows=patch?arr.map(r=>({...r,...patch})):arr;
 const r=inspect(rows);
 assert.equal(r.status,"BLOCKED");assert.equal(r.eligible,false);
 assert.ok(r.dimensions.some(x=>x.dimension===dimension));
 if(patch)assert.ok(r.dimensions.find(x=>x.dimension===dimension).affected>0,label);
});
test("invalid batch",()=>assert.equal(inspect(null).reasonCounts.INVALID_BATCH,1));
test("truncation",()=>assert.equal(inspect([good(),good()],{limit:1}).truncated,true));
test("duplicate counts",()=>assert.equal(inspect([good(),good()]).reasonCounts.DUPLICATE_OBSERVATION,1));
test("sample limit zero",()=>assert.equal(inspect([good()],{sampleLimit:0}).samples.length,0));
test("sample max 20",()=>assert.equal(inspect(Array.from({length:22},good),{sampleLimit:200}).samples.length,20));
test("bounded 1000",()=>assert.equal(inspect(Array.from({length:1001},good),{limit:5000}).checked,1000));
test("never approved with seemingly complete input",()=>assert.equal(inspect([good()]).eligible,false));
