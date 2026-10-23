import test from "node:test";
import assert from "node:assert/strict";
import {classifyAfternoonRebound} from "../app/lib/research/afternoonReboundStudy.mjs";

test("synthetic example: afternoon new high",()=>{
  const r=classifyAfternoonRebound({morningHigh:3490,morningLow:3375,afternoonHigh:3510,afternoonLow:3415,afternoonLast:3485,previousClose:3400});
  assert.equal(r.status,"OBSERVED");
  assert.equal(r.afternoonNewHigh,true);
});
test("missing values never imply a prediction",()=>{
  assert.equal(classifyAfternoonRebound({}).status,"UNAVAILABLE");
});
test("inconsistent bars fail closed",()=>{
  assert.equal(classifyAfternoonRebound({morningHigh:10,morningLow:11,afternoonHigh:12,afternoonLow:9,afternoonLast:10,previousClose:10}).status,"UNAVAILABLE");
});
