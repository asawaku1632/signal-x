import test from "node:test";
import assert from "node:assert/strict";
import { checkForwardScoreBandStability } from "../app/lib/research/dailyForwardStability.mjs";

test("repeated winning signals from one stock do not pass independence coverage",()=>{
  const rows=Array.from({length:30},(_,i)=>({
    horizon:10,score:30,code:"1234",date:"2026-10-"+String(i%20+1).padStart(2,"0"),
    status:"VERIFIED",returnPct:5,
  }));
  const result=checkForwardScoreBandStability(rows).find(x=>x.horizon===10&&x.band==="20-39");
  assert.equal(result.verifiedRows,30);
  assert.equal(result.distinctCodes,1);
  assert.equal(result.largestCodeShare,1);
  assert.equal(result.positiveCodeShare,null);
  assert.equal(result.status,"INSUFFICIENT_INDEPENDENT_COVERAGE");
});
test("multiple codes and dates allow descriptive stability only",()=>{
  const rows=Array.from({length:10},(_,i)=>({
    horizon:5,score:30,code:String(1000+i),date:"2026-10-"+String(i+1).padStart(2,"0"),
    status:"VERIFIED",returnPct:i<7?5:-3,
  }));
  const result=checkForwardScoreBandStability(rows).find(x=>x.horizon===5&&x.band==="20-39");
  assert.equal(result.status,"DESCRIPTIVE_STABILITY_ONLY");
  assert.equal(result.positiveCodeShare,0.7);
});
test("unverified records cannot create stability",()=>{
  const rows=[{horizon:5,score:30,code:"1234",date:"2026-10-01",status:"MISSING_FUTURE_PRICE",returnPct:99}];
  const result=checkForwardScoreBandStability(rows).find(x=>x.horizon===5&&x.band==="20-39");
  assert.equal(result.verifiedRows,0);
  assert.equal(result.positiveCodeShare,null);
});
