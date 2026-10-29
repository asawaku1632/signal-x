import test from "node:test";
import assert from "node:assert/strict";
import {reconcileMorningForwardLedger as reconcile} from "../app/lib/research/morningForwardLedger.mjs";
const sample={experimentId:"research-a",tradeDate:"2026-11-04",code:"7203",recordedAt:"2026-11-04T09:00:00+09:00",sourceVerified:true,researchUseAllowed:true};
const outcome={experimentId:"research-a",tradeDate:"2026-11-04",code:"7203",outcomeAvailableAt:"2026-11-04T16:00:00+09:00",outcomeSourceVerified:true,baselineReturn:0,candidateReturn:1};
test("claimed predecision and later result pair for offline inspection only",()=>{
 const r=reconcile({snapshots:[sample],outcomes:[outcome]});
 assert.equal(r.pairedCount,1);assert.equal(r.decision,"DO_NOT_PROMOTE");
 assert.equal(r.independentlyAuthenticated,false);
});
test("mismatched code cannot be paired",()=>{
 const r=reconcile({snapshots:[sample],outcomes:[{...outcome,code:"6758"}]});
 assert.equal(r.pairedCount,0);assert.equal(r.reasons.missingOutcome,1);
});
test("duplicates and missing outcomes fail closed",()=>{
 const a=reconcile({snapshots:[sample,sample],outcomes:[outcome]});
 const b=reconcile({snapshots:[sample],outcomes:[outcome,outcome]});
 assert.equal(a.pairedCount,0);assert.equal(a.reasons.duplicateSnapshot,1);
 assert.equal(b.pairedCount,0);assert.equal(b.reasons.duplicateOutcome,1);
});
test("after-decision snapshot and unlicensed source rejected",()=>{
 assert.equal(reconcile({snapshots:[{...sample,recordedAt:"2026-11-04T09:06:00+09:00"}],outcomes:[outcome]}).reasons.invalidPredecision,1);
 assert.equal(reconcile({snapshots:[{...sample,researchUseAllowed:false}],outcomes:[outcome]}).reasons.missingRights,1);
});
test("unknown or premature outcomes excluded",()=>{
 assert.equal(reconcile({snapshots:[sample],outcomes:[{...outcome,outcomeAvailableAt:"2026-11-04T09:04:00+09:00"}]}).reasons.invalidOutcome,1);
});

test("impossible snapshot and outcome timestamps are rejected",()=>{
 const invalid=["2026-02-30T08:59:00+09:00","2026-11-04T24:00:00+09:00","2026-11-04T09:00:00+25:00"];
 for(const recordedAt of invalid){
  const r=reconcile({snapshots:[{...sample,recordedAt}],outcomes:[outcome]});
  assert.equal(r.pairedCount,0);assert.equal(r.reasons.invalidPredecision,1);
 }
 for(const outcomeAvailableAt of invalid){
  const r=reconcile({snapshots:[sample],outcomes:[{...outcome,outcomeAvailableAt}]});
  assert.equal(r.pairedCount,0);assert.equal(r.reasons.invalidOutcome,1);
 }
});

test("separator characters in experiment identifiers never collide with distinct keys",()=>{
 const a={...sample,experimentId:"group|2026-11-04|part"};
 const b={...sample,experimentId:"group",code:"part|2026-11-04|7203"};
 const r=reconcile({snapshots:[a,b],outcomes:[{...outcome,experimentId:a.experimentId}]});
 assert.equal(r.pairedCount,1);
 assert.equal(r.reasons.duplicateSnapshot,0);
});
