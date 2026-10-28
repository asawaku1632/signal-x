import test from "node:test";
import assert from "node:assert/strict";
import { summarizeGroup, validOutcome, withoutLargestDay } from "../app/lib/research/repeatCandidateStats.ts";

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
