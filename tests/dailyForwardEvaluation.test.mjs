import test from "node:test";
import assert from "node:assert/strict";
import { evaluateDailyForward } from "../app/lib/research/dailyForwardEvaluation.mjs";

const sessions = Array.from({length: 23}, (_, i) => {
  const d = new Date(Date.UTC(2026, 0, i + 1));
  return d.toISOString().slice(0, 10);
});
// Explicit synthetic sessions: calendar sequence is supplied, not inferred by evaluator.
const prediction = {id:"p1",code:"1234",date:sessions[0],score:55,referencePrice:100,priceBasisVerified:true};
const close = (i, value, overrides = {}) => ({code:"1234",date:sessions[i],close:value,priceBasisVerified:true,...overrides});

test("separates 5 10 20-session outcomes without altering source", () => {
  const source = structuredClone(prediction);
  const result = evaluateDailyForward({predictions:[prediction],closes:[close(5,110),close(10,90),close(20,100)],sessions});
  assert.deepEqual(result.rows.map(r=>r.returnPct),[10,-10,0]);
  assert.deepEqual(result.rows.map(r=>r.status),["VERIFIED","VERIFIED","VERIFIED"]);
  assert.deepEqual(result.summary.map(r=>r.positiveRate),[1,0,0]);
  assert.deepEqual(prediction,source);
});

test("does not claim wins when future sessions have not matured", () => {
  const r=evaluateDailyForward({predictions:[{...prediction,date:sessions[20]}],closes:[],sessions});
  assert.deepEqual(r.rows.map(x=>x.status),["NOT_MATURED","NOT_MATURED","NOT_MATURED"]);
  assert.equal(r.summary[0].positiveRate,null);
});

test("rejects missing, duplicate and corporate-action-uncertain future prices", () => {
  const r=evaluateDailyForward({predictions:[prediction],closes:[
    close(5,110),close(5,111),close(10,120,{corporateActionUnresolved:true})
  ],sessions});
  assert.deepEqual(r.rows.map(x=>x.status),["DUPLICATE_FUTURE_PRICE","PRICE_BASIS_UNVERIFIED","MISSING_FUTURE_PRICE"]);
  assert.ok(r.rows.every(x=>x.returnPct===null));
});

test("rejects unverifiable original reference price basis", () => {
  const r=evaluateDailyForward({predictions:[{...prediction,priceBasisVerified:false}],closes:[close(5,110)],sessions});
  assert.ok(r.rows.every(x=>x.status==="PRICE_BASIS_UNVERIFIED"));
});

test("fails on duplicate ids and invalid calendar", () => {
  assert.throws(()=>evaluateDailyForward({predictions:[prediction,prediction],closes:[],sessions}),/unique/);
  assert.throws(()=>evaluateDailyForward({predictions:[],closes:[],sessions:[sessions[1],sessions[0]]}),/ascending/);
});
