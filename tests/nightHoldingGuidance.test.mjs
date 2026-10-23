import test from "node:test";
import assert from "node:assert/strict";
import {historicPeriodEvidence} from "../app/lib/research/nightHoldingGuidance.mjs";

function point(i,{date,score=96,missing=false}={}){
  return {date:date??"2026-10-"+String(i%10+1).padStart(2,"0"),code:String(3000+i),
    score,entries:{"09:05":100},exits:{1:101,3:missing?null:103,5:99}};
}
test("insufficient cases show no guessed winning horizon",()=>{
  const r=historicPeriodEvidence([point(1)],"2026-10-26",96);
  assert.equal(r.ready,false);assert.equal(r.periods[0].positiveRate,null);assert.equal(r.leader,null);
});
test("exclude target-day and future-day outcomes, wrong band, and missing exit",()=>{
  const items=[...Array.from({length:30},(_,i)=>point(i)),point(30,{date:"2026-10-26"}),point(31,{score:87}),point(32,{missing:true})];
  const r=historicPeriodEvidence(items,"2026-10-26",96);
  assert.equal(r.count,30);assert.equal(r.days,10);
  assert.equal(r.ready,true);assert.equal(r.periods[0].positiveRate,100);
  assert.equal(r.periods[2].positiveRate,0);
  assert.equal(r.periods[1].meanPct,3);
  assert.equal(r.leader,null);
});
test("future hindsight cannot change historical 09:05 cohort",()=>{
  const items=Array.from({length:30},(_,i)=>point(i));
  assert.deepEqual(historicPeriodEvidence(items,"2026-10-26",95),
    historicPeriodEvidence([...items,point(35,{date:"2026-10-27"})],"2026-10-26",95));
});
test("all 1/3/5 horizons use same full-data cohort",()=>{
  const items=[...Array.from({length:30},(_,i)=>point(i)),point(30,{missing:true})];
  const r=historicPeriodEvidence(items,"2026-10-26",96);
  assert.deepEqual(r.periods.map(x=>x.count),[30,30,30]);
  assert.equal(historicPeriodEvidence(items,"2026-10-26",80).ready,false);
});
