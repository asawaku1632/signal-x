import test from "node:test";
import assert from "node:assert/strict";
import { compareForwardScoreBandsAcrossPeriods } from "../app/lib/research/dailyForwardChronologicalHoldout.mjs";
const sessions=Array.from({length:100},(_,i)=>new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10));
const row=(i,returnPct,status="VERIFIED")=>({horizon:5,score:30,code:String(1000+i),date:sessions[i],status,returnPct});
const run=(rows,options={})=>compareForwardScoreBandsAcrossPeriods(rows,{
  verifiedSessions:sessions,cutoffDate:sessions[50],embargoSessions:10,minSamplePerPeriod:2,...options,
}).find((r)=>r.horizon===5&&r.band==="20-39");

test("compares matured historical outcomes against embargoed later period",()=>{
  const result=run([row(10,10),row(11,-5),row(60,-2),row(61,-3)]);
  assert.equal(result.historical.n,2);
  assert.equal(result.future.n,2);
  assert.equal(result.historical.positiveRate,0.5);
  assert.equal(result.future.positiveRate,0);
  assert.equal(result.positiveRateDifference,-0.5);
  assert.equal(result.status,"DESCRIPTIVE_HOLDOUT_ONLY");
});
test("does not leak pre-cutoff immature outcomes or embargoed signals",()=>{
  const result=run([row(48,99),row(50,99),row(59,99),row(60,2)]);
  assert.equal(result.historical.n,0);
  assert.equal(result.future.n,1);
  assert.equal(result.status,"INSUFFICIENT_PERIOD_COVERAGE");
});
test("unverified outcomes are not counted",()=>{
  const result=run([row(10,100,"PRICE_BASIS_UNVERIFIED"),row(60,100,"MISSING_FUTURE_PRICE")]);
  assert.equal(result.historical.n,0);
  assert.equal(result.future.n,0);
});
test("invalid cutoff and sessions reject",()=>{
  assert.throws(()=>run([],{cutoffDate:"2020-01-01"}),/cutoffDate/);
  assert.throws(()=>run([],{verifiedSessions:["2026-01-02","2026-01-01"]}),/sessions/);
});
