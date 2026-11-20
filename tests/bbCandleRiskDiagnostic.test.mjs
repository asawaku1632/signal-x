import test from "node:test";
import assert from "node:assert/strict";
import {featuresAtCompletedSignal,buildRiskDiagnostics} from "../scripts/research/bb-candle-risk-diagnostic.mjs";
const b=(time,close,volume)=>({time,open:close-1,high:close+1,low:close-2,close,volume});
test("features use completed signal plus previous bars, never future",()=>{
 const bars=Array.from({length:23},(_,i)=>b(i+1,100+i,10));
 const h={index:20,direction:"BUY",bbWidth:.02};
 const first=featuresAtCompletedSignal(bars,h);
 bars[21]=b(22,9999,1000000);
 bars[22]=b(23,9999,1000000);
 assert.deepEqual(featuresAtCompletedSignal(bars,h),first);
 assert.equal(first.volumeVsPrior20,1);
 assert.equal(first.bbWidthPct,2);
});
test("bad input and unproven cohort never issue risk guidance",()=>{
 assert.throws(()=>buildRiskDiagnostics({benchmark:{benchmark:"TOPIX"},threeArchives:[]}),/INVALID_RISK_COHORT/);
 const bars=Array.from({length:21},(_,i)=>b(i+1,100+i,10));
 assert.throws(()=>featuresAtCompletedSignal(bars,{index:20,direction:"SELL",bbWidth:.02}),/INVALID_FEATURE_SIGNAL/);
});
