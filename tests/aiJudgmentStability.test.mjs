import test from "node:test";
import assert from "node:assert/strict";
import {bandForScore,evaluateJudgmentStability,summarizeStability,onlyCompleteSevenSlotStudies,JST_SLOTS} from "../app/lib/research/aiJudgmentStability.mjs";
const sample=(code,slot,score,price=3100,date="2026-10-14",extra={})=>
  ({trade_date:date,time_slot:slot,code,name:code,entry_price:price,ai_power:score,
    sampled_at:date+"T"+slot+":00+09:00",outcome_date:"2026-10-15",...extra});
test("scores are interpreted using analysis-page band thresholds, never swing labels",()=>{
  assert.equal(bandForScore(95),"PRIME");assert.equal(bandForScore(94.9),"BUY_CANDIDATE");
  assert.equal(bandForScore(85),"BUY_CANDIDATE");assert.equal(bandForScore(75),"PULLBACK");
  assert.equal(bandForScore(65),"WATCH");assert.equal(bandForScore(49),"PASS");
  assert.equal(bandForScore(null),null);assert.equal(bandForScore(-3),null);
  assert.equal(bandForScore(200),null);
});
test("one observation is not assumed to be a stable AI judgment",()=>{
  const rows=evaluateJudgmentStability([sample("3762","09:15",49)]);
  assert.equal(rows[0].group,"INSUFFICIENT");
  assert.equal(summarizeStability(rows).comparable,0);
});
test("score band transitions follow the observed time sequence; missing time does not count as flip",()=>{
  const rows=[sample("3762","11:00",76),sample("3762","09:15",49),
    sample("3762","13:00",63),sample("3762","15:15",63)];
  // 11:00 isn't one of the archived Golden Zone slots. Unarchived screenshots
  // cannot be silently imported as real observations.
  const [r]=evaluateJudgmentStability(rows);
  assert.equal(r.samples,3);
  assert.equal(r.changes,0);
  assert.equal(r.group,"STABLE");
});
test("same stock's 85 -> 74 -> 95 moves bands twice",()=>{
  const [r]=evaluateJudgmentStability([
    sample("3762","10:30",74),sample("3762","09:15",85),sample("3762","14:30",95)]);
  assert.equal(r.changes,2);assert.equal(r.group,"CHANGED");
  assert.equal(r.scoreRange,21);
});
test("same band varying score stays stable while duplicate slot is ignored",()=>{
  const [r]=evaluateJudgmentStability([sample("3762","09:15",81),
    sample("3762","09:15",66),sample("3762","10:30",79)]);
  assert.equal(r.changes,0);assert.equal(r.samples,2);
});
test("next-day close is not guessed when missing or date is invalid",()=>{
  const [r]=evaluateJudgmentStability([sample("3762","09:15",80),sample("3762","09:30",89)]);
  assert.equal(r.futureReturnPct,null);
  assert.equal(summarizeStability([r]).changed.judged,0);
  const [v]=evaluateJudgmentStability([
    sample("3762","09:15",80,3000,"2026-10-14",{outcome_price:3100}),
    sample("3762","09:30",89,3020,"2026-10-14",{outcome_price:3100})]);
  // Classifying from an observed 09:30 change must not pretend we bought at 09:15.
  assert.equal(v.evaluationSlot,"09:30");
  assert.equal(v.entryPriceForOutcome,3020);
  assert.ok(Math.abs(v.futureReturnPct-2.649)<.01);
});
test("group comparisons use actual outcomes and disclose denominators, no zero-sample fake win rate",()=>{
  const rows=evaluateJudgmentStability([
    sample("3762","09:15",81,3100,"2026-10-13",{outcome_price:3150,outcome_date:"2026-10-14"}),
    sample("3762","09:30",90,3105,"2026-10-13",{outcome_price:3150,outcome_date:"2026-10-14"}),
    sample("6758","09:15",90,2000,"2026-10-13",{outcome_price:1900,outcome_date:"2026-10-14"}),
    sample("6758","09:30",91,2010,"2026-10-13",{outcome_price:1900,outcome_date:"2026-10-14"})]);
  const s=summarizeStability(rows);
  assert.equal(s.changed.judged,1);assert.equal(s.changed.wins,1);
  assert.equal(s.stable.judged,1);assert.equal(s.stable.wins,0);
  assert.equal(s.changed.winRate,100);assert.equal(s.stable.winRate,0);
});

test("fixed-cohort performance requires all seven slots; incomplete observations are not stability evidence",()=>{
  const complete=JST_SLOTS.map((slot,i)=>sample("3762",slot,i===0?85:90));
  const incomplete=[sample("6758","09:15",85),sample("6758","09:30",90)];
  const rows=evaluateJudgmentStability([...complete,...incomplete]);
  const valid=onlyCompleteSevenSlotStudies(rows);
  assert.equal(valid.length,1);
  assert.equal(valid[0].code,"3762");
  assert.equal(valid[0].evaluationSlot,"15:15");
  assert.equal(summarizeStability(valid).stable.candidates,1);
});
