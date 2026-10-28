import test from "node:test";
import assert from "node:assert/strict";
import {summarizeSavedDailyResults} from "../app/lib/research/savedDailyBaseline.mjs";
test("daily historical summary counts unique completed observations",()=>{
 const rows=[
  {date:"2026-10-26",code:"590A",score:90,price:100,next_price:105},
  {date:"2026-10-27",code:"1234",score:90,price:100,next_price:90},
  {date:"2026-10-27",code:"1234",score:90,price:100,next_price:90}
 ];
 const result=summarizeSavedDailyResults(rows,{minSamples:2});
 assert.equal(result.samples,2);
 assert.equal(result.excluded.duplicate,1);
 assert.equal(result.positiveRatePct,50);
});

import {evaluateFrozenDailyDropRule} from "../app/lib/research/savedDailyBaseline.mjs";
test("frozen rule excludes all on-or-before freeze and handles outcomes",()=>{
 const row=(date,code,price,next_price)=>({date,code,score:90,previousScore:85,
  prior3ReturnPct:-6,price,next_price});
 const result=evaluateFrozenDailyDropRule([
  row("2026-10-28","1234",100,200),
  row("2026-10-29","1234",100,200),
  row("2026-10-30","1234",100,102),
  row("2026-10-30","1234",100,102),
  row("2026-11-02","590A",100,null)
 ],{minSamples:2});
 assert.equal(result.samples,1);
 assert.equal(result.eligible,false);
 assert.equal(result.positiveRatePct,null);
 assert.equal(result.excluded.beforeFreeze,2);
 assert.equal(result.excluded.duplicate,1);
 assert.equal(result.excluded.missingOutcome,1);
});
test("frozen thresholds cannot be retrospectively tuned",()=>{
 assert.throws(()=>evaluateFrozenDailyDropRule([],{rule:{
  id:"DAILY_DROP_SCORE_SHADOW_V1",frozenAt:"2026-10-29T00:00:00+09:00",
  minScore:80,maxScoreDeltaExclusive:10,maxPrior3ReturnPct:-5
 }}),/INVALID_FROZEN_RULE/);
});
