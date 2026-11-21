import test from "node:test";
import assert from "node:assert/strict";
import {compareFrozenPair} from "../scripts/research/bb-pair-preentry-diagnostic.mjs";
const row=(code,after5dPct,features)=>({code,date:"2026-11-04",slot:"14:15",
 asOfSlot:"14:10",after5dPct,worstDip5dPct:-2,
 patterns:["MARUBOZU"],features});
const f=(bbWidthPct,volumeVsPrior20)=>({bbWidthPct,volumeVsPrior20,
 bodyToRangePct:80,last5BarsPct:1});
test("compares only frozen pre-entry rows and retained outcome labels",()=>{
 const r=compareFrozenPair([row("8410",3.4245,f(1,2)),row("6326",-3.5519,f(2,1))]);
 assert.equal(r.after5dSpread8410Minus6326Pct,6.9764);
 assert.equal(r.differences.bbWidthPct.delta8410Minus6326,-1);
 assert.equal(r.eligibleForProduction,false);
 assert.equal(r.ma75DayPosition,"NOT_CALCULATED_IN_5M_CAPTURE_STUDY");
});
test("mismatched time, incomplete future return or duplicate stock fails closed",()=>{
 const a=row("6326",-3.5519,f(2,1)),b=row("8410",3.4245,f(1,2));
 assert.throws(()=>compareFrozenPair([a,{...b,asOfSlot:"14:15"}]),/INVALID_FROZEN_PAIR/);
 assert.throws(()=>compareFrozenPair([a,{...b,after5dPct:null}]),/INVALID_FROZEN_PAIR/);
 assert.throws(()=>compareFrozenPair([a,{...a}]),/INVALID_FROZEN_PAIR/);
});
test("feature null remains explicit, no automatic thresholds",()=>{
 const r=compareFrozenPair([row("6326",-3.5519,{...f(1,2),last5BarsPct:null}),
  row("8410",3.4245,f(1.3,1))]);
 assert.equal(r.differences.last5BarsPct.delta8410Minus6326,null);
 assert.equal(r.thresholdTuning,false);
});
