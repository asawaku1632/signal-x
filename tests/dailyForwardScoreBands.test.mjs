import test from "node:test";
import assert from "node:assert/strict";
import { summarizeVerifiedForwardByScoreBand } from "../app/lib/research/dailyForwardScoreBands.mjs";

test("does not publish rates from unverified or insufficient outcomes",()=>{
  const rows=[
    {horizon:5,score:30,status:"VERIFIED",returnPct:10},
    {horizon:5,score:30,status:"PRICE_BASIS_UNVERIFIED",returnPct:null},
    {horizon:5,score:90,status:"MISSING_FUTURE_PRICE",returnPct:null},
  ];
  const result=summarizeVerifiedForwardByScoreBand(rows);
  const low=result.find(x=>x.horizon===5 && x.band==="20-39");
  assert.equal(low.total,2);
  assert.equal(low.verified,1);
  assert.equal(low.excluded,1);
  assert.equal(low.positiveRate,null);
  assert.equal(low.status,"INSUFFICIENT_SAMPLE");
});
test("separates horizons and score bands with explicit sample threshold",()=>{
  const rows=[
    {horizon:5,score:30,status:"VERIFIED",returnPct:10},
    {horizon:5,score:30,status:"VERIFIED",returnPct:-5},
    {horizon:10,score:30,status:"VERIFIED",returnPct:20},
    {horizon:5,score:90,status:"VERIFIED",returnPct:8},
  ];
  const result=summarizeVerifiedForwardByScoreBand(rows,{minSample:2});
  const a=result.find(x=>x.horizon===5 && x.band==="20-39");
  assert.equal(a.positiveRate,0.5);
  assert.equal(a.averageReturnPct,2.5);
  assert.equal(result.find(x=>x.horizon===10 && x.band==="20-39").positiveRate,null);
  assert.equal(result.find(x=>x.horizon===5 && x.band==="80-100").positiveRate,null);
});
test("rejects malformed input",()=>{
  assert.throws(()=>summarizeVerifiedForwardByScoreBand(null),TypeError);
  assert.throws(()=>summarizeVerifiedForwardByScoreBand([],{minSample:0}),/minSample/);
});
