import test from "node:test";
import assert from "node:assert/strict";
import {classifyAfternoonRebound} from "../app/lib/research/afternoonReboundStudy.mjs";

const baseline={morningHigh:3490,morningLow:3375,afternoonHigh:3510,afternoonLow:3415,afternoonLast:3485,previousClose:3400};
test("synthetic afternoon high exceeds morning high",()=>{
  const r=classifyAfternoonRebound(baseline);
  assert.equal(r.status,"OBSERVED");
  assert.equal(r.afternoonNewHigh,true);
  assert.equal(r.label,"AFTERNOON_NEW_HIGH");
});
test("equal high is not a new high",()=>{
  const r=classifyAfternoonRebound({...baseline,morningHigh:3510});
  assert.equal(r.status,"OBSERVED");
  assert.equal(r.afternoonNewHigh,false);
});
test("lower afternoon high is not a new high",()=>{
  const r=classifyAfternoonRebound({...baseline,afternoonHigh:3480,afternoonLast:3470});
  assert.equal(r.afternoonNewHigh,false);
});
test("missing values never imply a prediction",()=>{
  assert.equal(classifyAfternoonRebound({}).status,"UNAVAILABLE");
});
test("invalid price never implies an observation",()=>{
  assert.equal(classifyAfternoonRebound({...baseline,previousClose:0}).status,"UNAVAILABLE");
});
test("inconsistent morning bars fail closed",()=>{
  assert.equal(classifyAfternoonRebound({...baseline,morningLow:3600}).status,"UNAVAILABLE");
});
test("inconsistent afternoon last fails closed",()=>{
  assert.equal(classifyAfternoonRebound({...baseline,afternoonLast:3600}).status,"UNAVAILABLE");
});
