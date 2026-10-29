import test from "node:test";
import assert from "node:assert/strict";
import {evaluateMorningShadowGate as gate} from "../app/lib/research/morningShadowGate.mjs";
const row=(i,overrides={})=>({
  code:String(1000+i%30),tradeDate:"2026-"+String(1+Math.floor(i/25)).padStart(2,"0")+"-"+String(1+i%25).padStart(2,"0"),
  forward5dReturnPct:i%5===0?-1:2,predictedProbability:0.8,
  regime:i%2?"UP":"DOWN",independentlyVerified:true,
  pointInTimeVerified:true,outcomeMatured:true,outOfSample:true,...overrides
});
test("empty evidence blocks notification and trading",()=>{
  const r=gate([]);
  assert.equal(r.status,"BLOCKED");
  assert.equal(r.notificationEnabled,false);
  assert.equal(r.readyForTrading,false);
  assert.ok(r.reasons.includes("INSUFFICIENT_CANDIDATES"));
});
test("many positive samples never bypass chronological baseline requirement",()=>{
  const r=gate(Array.from({length:150},(_,i)=>row(i)));
  assert.equal(r.counts.accepted,150);
  assert.equal(r.counts.months,6);
  assert.equal(r.status,"BLOCKED");
  assert.equal(r.notificationEnabled,false);
  assert.ok(r.reasons.includes("CHRONOLOGICAL_BASELINE_NOT_VERIFIED"));
});
test("duplicates and unverified records fail closed",()=>{
  const r=gate([row(0),row(0),row(1,{pointInTimeVerified:false})]);
  assert.equal(r.counts.accepted,1);
  assert.equal(r.counts.duplicate,1);
  assert.equal(r.counts.invalid,1);
  assert.ok(r.reasons.includes("DUPLICATE_STOCK_DATES"));
  assert.ok(r.reasons.includes("UNVERIFIED_OR_INVALID_ROWS"));
});
test("nonfinite predictions and future outcomes are excluded",()=>{
  const r=gate([row(0,{predictedProbability:NaN}),row(1,{outcomeMatured:false})]);
  assert.equal(r.counts.accepted,0);
  assert.equal(r.metrics.brier,null);
  assert.equal(r.notificationEnabled,false);
});
