import test from "node:test";
import assert from "node:assert/strict";
import {auditPredecisionEvidence as audit} from "../app/lib/research/predecisionEvidenceAudit.mjs";
const cutoffUtc="2026-10-29T00:05:00Z"; // 09:05 JST
const valid={sourceVerified:true,scoreVersionVerified:true,retentionAndResearchAllowed:true,
 featureGeneratedAtUtc:"2026-10-29T00:03:00Z",quoteObservedAtUtc:"2026-10-29T00:04:00Z",barEndedAtUtc:"2026-10-29T00:04:00Z"};
test("caller-attested candidate never grants production or training readiness",()=>{
 const result=audit([valid],{cutoffUtc});
 assert.equal(result.eligible,1);
 assert.equal(result.independentlyValidated,false);
 assert.equal(result.readyForTraining,false);
 assert.equal(result.readyForTrading,false);
});
test("legacy naive timestamps and missing provenance fail closed",()=>{
 const result=audit([{...valid,featureGeneratedAtUtc:"2026-10-29 00:03:00"},{...valid,sourceVerified:false}],{cutoffUtc});
 assert.equal(result.eligible,0);
 assert.deepEqual(result.reasons,{missingProvenance:1,invalidTimestamp:1,afterCutoff:0,missingSourceRights:0});
});
test("later-generated feature or delayed quote and bar-end fail cutoff",()=>{
 const result=audit([{...valid,featureGeneratedAtUtc:"2026-10-29T00:06:00Z"},{...valid,quoteObservedAtUtc:"2026-10-29T00:06:00Z"},
 {...valid,barEndedAtUtc:"2026-10-29T00:06:00Z"}],{cutoffUtc});
 assert.equal(result.reasons.afterCutoff,3);
});
test("unlicensed source is ineligible even if timestamps seem valid",()=>{
 const result=audit([{...valid,retentionAndResearchAllowed:false}],{cutoffUtc});
 assert.equal(result.reasons.missingSourceRights,1);
});
test("reject invalid cutoff and impossible calendar dates",()=>{
 assert.throws(()=>audit([],{cutoffUtc:"2026-10-29 09:05:00"}),/INVALID_CUTOFF/);
 assert.throws(()=>audit(null,{cutoffUtc}),/INVALID_EVIDENCE_ROWS/);
 assert.equal(audit([{...valid,quoteObservedAtUtc:"2026-02-30T00:04:00Z"}],{cutoffUtc}).reasons.invalidTimestamp,1);
});

test("reject impossible UTC clock and offset-free timestamps in all evidence fields",()=>{
 const invalid=["2026-02-30T00:04:00Z","2026-10-29T24:00:00Z","2026-10-29T00:60:00Z","2026-10-29T00:04:60Z"];
 for(const field of ["featureGeneratedAtUtc","quoteObservedAtUtc","barEndedAtUtc"]){
  for(const value of invalid){
   assert.equal(audit([{...valid,[field]:value}],{cutoffUtc}).reasons.invalidTimestamp,1);
  }
 }
 for(const value of invalid)assert.throws(()=>audit([],{cutoffUtc:value}),/INVALID_CUTOFF/);
});
