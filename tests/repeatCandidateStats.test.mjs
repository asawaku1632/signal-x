import test from "node:test";
import assert from "node:assert/strict";
import { summarizeGroup, validOutcome, withoutLargestDay, sameDayComparison, outcomeCoverageByDate, matchedDaySensitivity, assessedOutcomeCoverage } from "../app/lib/research/repeatCandidateStats.ts";

test("no observations stays unverified rather than zero return", () => {
  assert.deepEqual(summarizeGroup([]), {count:0,checked:0,days:0,average:null,dateBalancedAverage:null});
});
test("null and blank outcomes never become zero", () => {
  assert.equal(validOutcome(null),null);
  assert.equal(validOutcome(""),null);
  assert.equal(validOutcome("  "),null);
  assert.equal(validOutcome("NaN"),null);
  assert.equal(validOutcome("Infinity"),null);
  assert.equal(validOutcome("0"),0);
});
test("observation weighted versus date balanced average", () => {
  const result=summarizeGroup([
    {trade_date:"2026-10-19",return_5d:-10},
    {trade_date:"2026-10-19",return_5d:-20},
    {trade_date:"2026-10-16",return_5d:5},
    {trade_date:"2026-10-23",return_5d:null},
  ]);
  assert.equal(result.count,4);
  assert.equal(result.checked,3);
  assert.equal(result.days,2);
  assert.equal(result.average,-25/3);
  assert.equal(result.dateBalancedAverage,-5);
});
test("largest trading date exclusion recomputes remaining sample", () => {
  const result=withoutLargestDay([
    {trade_date:"2026-10-19",return_5d:-10},
    {trade_date:"2026-10-19",return_5d:-20},
    {trade_date:"2026-10-16",return_5d:5},
    {trade_date:"2026-10-23",return_5d:null},
  ]);
  assert.equal(result.topDate,"2026-10-19");
  assert.equal(result.checked,1);
  assert.equal(result.days,1);
  assert.equal(result.average,5);
});
test("negative outcome and observed zero count as evaluated", () => {
  const result=summarizeGroup([{trade_date:"2026-10-19",return_5d:"0"},{trade_date:"2026-10-19",return_5d:"-2.5"}]);
  assert.equal(result.checked,2);
  assert.equal(result.average,-1.25);
});

test("matched-day difference weights days equally, not rows", () => {
  const records = [
    {trade_date:"2026-10-19",previous_candidate_change_pct:-6,return_5d:-10},
    {trade_date:"2026-10-19",previous_candidate_change_pct:-7,return_5d:-20},
    {trade_date:"2026-10-19",previous_candidate_change_pct:0,return_5d:0},
    {trade_date:"2026-10-16",previous_candidate_change_pct:-6,return_5d:5},
    {trade_date:"2026-10-16",previous_candidate_change_pct:0,return_5d:1},
    {trade_date:"2026-10-23",previous_candidate_change_pct:-6,return_5d:null},
  ];
  const result=sameDayComparison(records);
  assert.equal(result.matchedDayCount,2);
  assert.equal(result.days[0].gap,-15);
  assert.equal(result.days[1].gap,4);
  assert.equal(result.dateBalancedGap,-5.5);
});
test("unmatched dates and pending data never enter paired comparison", () => {
  const result=sameDayComparison([
    {trade_date:"2026-10-16",previous_candidate_change_pct:-6,return_5d:-3},
    {trade_date:"2026-10-19",previous_candidate_change_pct:0,return_5d:8},
    {trade_date:"2026-10-23",previous_candidate_change_pct:-6,return_5d:null},
    {trade_date:"2026-10-23",previous_candidate_change_pct:0,return_5d:2},
  ]);
  assert.equal(result.matchedDayCount,0);
  assert.equal(result.dateBalancedGap,null);
});
test("exact -5 percent stays outside strict down5 group", () => {
  const result=sameDayComparison([
    {trade_date:"2026-10-19",previous_candidate_change_pct:-5,return_5d:1},
    {trade_date:"2026-10-19",previous_candidate_change_pct:-5.000001,return_5d:3},
  ]);
  assert.equal(result.matchedDayCount,1);
  assert.equal(result.days[0].gap,2);
});

test("daily coverage excludes pending outcomes from completion", () => {
  const result=outcomeCoverageByDate([
    {trade_date:"2026-10-23",return_5d:null},
    {trade_date:"2026-10-23",return_5d:""},
    {trade_date:"2026-10-23",return_5d:0},
    {trade_date:"2026-10-19",return_5d:-3},
  ]);
  assert.deepEqual(result.map(x=>[x.date,x.total,x.completed,x.pending,x.completionRate]),
    [["2026-10-23",3,1,2,100/3],["2026-10-19",1,1,0,100]]);
});
test("empty daily coverage remains empty", () => {
  assert.deepEqual(outcomeCoverageByDate([]),[]);
});

test("matched-day exclusion reports range over independent dates", () => {
  const rows = [
    {trade_date:"2026-10-16",previous_candidate_change_pct:-6,return_5d:-10},
    {trade_date:"2026-10-16",previous_candidate_change_pct:0,return_5d:0},
    {trade_date:"2026-10-19",previous_candidate_change_pct:-6,return_5d:5},
    {trade_date:"2026-10-19",previous_candidate_change_pct:0,return_5d:1},
  ];
  const result=matchedDaySensitivity(rows);
  assert.equal(result.variants.length,2);
  assert.equal(result.minimum,-10);
  assert.equal(result.maximum,4);
  assert.ok(result.variants.every(v=>v.remainingDays===1));
});
test("no matched pairs does not fabricate robustness", () => {
  const result=matchedDaySensitivity([{trade_date:"2026-10-23",previous_candidate_change_pct:-6,return_5d:null}]);
  assert.equal(result.minimum,null);
  assert.equal(result.maximum,null);
});

test("overall completion rate counts zero returns and excludes missing outcomes", () => {
  const result = assessedOutcomeCoverage([{trade_date:"2026-10-19",return_5d:0},{trade_date:"2026-10-23",return_5d:null},{trade_date:"2026-10-26",return_5d:""}]);
  assert.equal(result.checked,1);
  assert.equal(result.pending,2);
  assert.equal(result.completionRate,100/3);
  assert.equal(assessedOutcomeCoverage([]).completionRate,null);
});
