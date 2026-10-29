import test from "node:test";
import assert from "node:assert/strict";
import { summarizeGroup, validOutcome, withoutLargestDay, sameDayComparison, outcomeCoverageByDate, matchedDaySensitivity, assessedOutcomeCoverage, thresholdSensitivity, outcomeDateIntegrity, excludeUnverifiedDatedOutcomes, outcomeCalendarAudit, weekdayGapAudit, completedDateConcentration, cohortCoverageContrast, pairedDayCompletion, fullyObservedDayComparison, repeatRiskEvidenceGate } from "../app/lib/research/repeatCandidateStats.ts";

test("no observations stays unverified rather than zero return", () => {
  assert.deepEqual(summarizeGroup([]), {median:null,positiveRate:null,count:0,checked:0,days:0,average:null,dateBalancedAverage:null});
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
  assert.ok(Math.abs(result.completionRate - 100/3) < 1e-10);
  assert.equal(assessedOutcomeCoverage([]).completionRate,null);
});

test("threshold sensitivity has nested cohorts and leaves missing outcomes pending", () => {
 const result=thresholdSensitivity([
 {trade_date:"2026-10-19",previous_candidate_change_pct:-4,return_5d:1},
 {trade_date:"2026-10-19",previous_candidate_change_pct:-6,return_5d:-3},
 {trade_date:"2026-10-20",previous_candidate_change_pct:-8,return_5d:null},
 {trade_date:"2026-10-20",previous_candidate_change_pct:0,return_5d:9}
 ]);
 assert.deepEqual(result.map(x=>[x.drop,x.count,x.checked,x.pending]),[[3,3,2,1],[5,2,1,1],[7,1,0,1]]);
 assert.equal(result[2].dateBalancedAverage,null);
});

test("outcome date audit catches missing and reversed date relationships", () => {
  const audit = outcomeDateIntegrity([
    { trade_date:"2026-10-19", return_5d:0, outcome_5d_date:null },
    { trade_date:"2026-10-19", return_5d:null, outcome_5d_date:"2026-10-26" },
    { trade_date:"2026-10-19", return_5d:-1, outcome_5d_date:"2026-10-16" },
    { trade_date:"2026-10-19", return_5d:-1, outcome_5d_date:"2026-10-26" },
  ]);
  assert.deepEqual(audit, {returnWithoutDate:1,dateWithoutReturn:1,outcomeBeforeTrade:1,suspectCount:3});
});
test("complete consistent outcomes have no date integrity warnings", () => {
  assert.equal(outcomeDateIntegrity([{trade_date:"2026-10-19",return_5d:0,outcome_5d_date:"2026-10-26"}]).suspectCount,0);
});

test("invalid or missing outcome dates cannot enter performance statistics", () => {
  const rows = [
    {trade_date:"2026-10-19",outcome_5d_date:"2026-10-26",return_5d:3},
    {trade_date:"2026-10-19",outcome_5d_date:null,return_5d:-20},
    {trade_date:"2026-10-19",outcome_5d_date:"2026-10-16",return_5d:-50},
    {trade_date:"2026-10-19",outcome_5d_date:"2026-02-30",return_5d:12},
    {trade_date:"2026-10-23",outcome_5d_date:null,return_5d:null},
  ];
  const cleaned=excludeUnverifiedDatedOutcomes(rows);
  assert.equal(summarizeGroup(cleaned).checked,1);
  assert.equal(summarizeGroup(cleaned).average,3);
  assert.equal(rows[1].return_5d,-20);
  assert.equal(cleaned[4].return_5d,null);
});

test("calendar audit rejects impossible dates and same-day five-day outcomes", () => {
  const rows=[
    {trade_date:"2026-10-19",outcome_5d_date:"2026-02-30",return_5d:1},
    {trade_date:"2026-10-19",outcome_5d_date:"2026-10-19",return_5d:1},
    {trade_date:"2026-10-19",outcome_5d_date:"2026-10-26",return_5d:1},
  ];
  assert.deepEqual(outcomeCalendarAudit(rows),{invalidCalendarDate:1,sameDayOutcome:1});
  const filtered=excludeUnverifiedDatedOutcomes(rows);
  assert.equal(summarizeGroup(filtered).checked,1);
});

test("weekday-only five-day screening counts completed outcomes without assuming holidays", () => {
  const rows=[
    {trade_date:"2026-10-19",outcome_5d_date:"2026-10-26",return_5d:-2},
    {trade_date:"2026-10-19",outcome_5d_date:"2026-10-23",return_5d:1},
    {trade_date:"2026-10-19",outcome_5d_date:null,return_5d:4},
    {trade_date:"2026-10-19",outcome_5d_date:null,return_5d:null},
  ];
  assert.deepEqual(weekdayGapAudit(rows),{assessed:2,weekdayMismatch:1,insufficientCalendarEvidence:1});
});

test("median and positive share resist a single large outlier", () => {
  const result=summarizeGroup([
    {trade_date:"2026-10-19",return_5d:-10},
    {trade_date:"2026-10-19",return_5d:2},
    {trade_date:"2026-10-22",return_5d:80},
    {trade_date:"2026-10-23",return_5d:null},
  ]);
  assert.equal(result.median,2);
  assert.ok(Math.abs(result.positiveRate-200/3)<1e-9);
  assert.equal(result.checked,3);
});

test("SQL exact drop flag overrides six-decimal rounded percentage", () => {
  const rows=[
    {trade_date:"2026-10-19",previous_candidate_change_pct:-5,previous_candidate_drop_over_5pct:true,return_5d:-3},
    {trade_date:"2026-10-19",previous_candidate_change_pct:-5,previous_candidate_drop_over_5pct:false,return_5d:1},
  ];
  assert.equal(sameDayComparison(rows).matchedDayCount,1);
  assert.equal(sameDayComparison(rows).days[0].gap,-4);
  assert.equal(thresholdSensitivity(rows,[5])[0].count,1);
});

test("completed day concentration excludes pending records", () => {
  const result=completedDateConcentration([
    {trade_date:"2026-10-19",return_5d:-10},
    {trade_date:"2026-10-19",return_5d:0},
    {trade_date:"2026-10-22",return_5d:-2},
    {trade_date:"2026-10-23",return_5d:null},
  ]);
  assert.equal(result.total,3);
  assert.equal(result.days,2);
  assert.equal(result.dominantDate,"2026-10-19");
  assert.ok(Math.abs(result.dominantShare-200/3)<1e-9);
  assert.equal(completedDateConcentration([]).dominantShare,null);
});

test("cohort outcome completion exposes missingness imbalance", () => {
  const rows=[
    {trade_date:"2026-10-19",previous_candidate_change_pct:-6,previous_candidate_drop_over_5pct:true,return_5d:-10},
    {trade_date:"2026-10-23",previous_candidate_change_pct:-6,previous_candidate_drop_over_5pct:true,return_5d:null},
    {trade_date:"2026-10-19",previous_candidate_change_pct:0,previous_candidate_drop_over_5pct:false,return_5d:1},
  ];
  const result=cohortCoverageContrast(rows);
  assert.equal(result.risk.completionRate,50);
  assert.equal(result.other.completionRate,100);
  assert.equal(result.completionGapPoints,-50);
  assert.equal(cohortCoverageContrast([]).completionGapPoints,null);
});

test("paired-day completion distinguishes partial from fully observed dates", () => {
 const rows=[{trade_date:"2026-10-19",previous_candidate_drop_over_5pct:true,previous_candidate_change_pct:-6,return_5d:-3},{trade_date:"2026-10-19",previous_candidate_drop_over_5pct:false,previous_candidate_change_pct:0,return_5d:null},{trade_date:"2026-10-22",previous_candidate_drop_over_5pct:true,previous_candidate_change_pct:-6,return_5d:1},{trade_date:"2026-10-22",previous_candidate_drop_over_5pct:false,previous_candidate_change_pct:0,return_5d:2}];
 const result=pairedDayCompletion(rows);
 assert.equal(result.length,2);
 assert.equal(result[0].bothComplete,true);
 assert.equal(result[1].bothComplete,false);
 assert.equal(result[1].other.pending,1);
});

test("fully observed matched comparison excludes partially pending dates", () => {
 const rows=[{trade_date:"2026-10-19",previous_candidate_change_pct:-6,previous_candidate_drop_over_5pct:true,return_5d:-10},{trade_date:"2026-10-19",previous_candidate_change_pct:0,previous_candidate_drop_over_5pct:false,return_5d:0},{trade_date:"2026-10-22",previous_candidate_change_pct:-6,previous_candidate_drop_over_5pct:true,return_5d:-2},{trade_date:"2026-10-22",previous_candidate_change_pct:0,previous_candidate_drop_over_5pct:false,return_5d:5},{trade_date:"2026-10-22",previous_candidate_change_pct:0,previous_candidate_drop_over_5pct:false,return_5d:null}];
 const result=fullyObservedDayComparison(rows);
 assert.equal(result.matchedDayCount,1);
 assert.equal(result.dateBalancedGap,-10);
 assert.equal(result.excludedPartialDays,1);
});

test("risk evidence gate remains HOLD despite favorable sample statistics", () => {
  const rows=[{trade_date:"2026-10-19",previous_candidate_drop_over_5pct:true,previous_candidate_change_pct:-6,return_5d:-10},{trade_date:"2026-10-19",previous_candidate_drop_over_5pct:false,previous_candidate_change_pct:0,return_5d:2}];
  const result=repeatRiskEvidenceGate(rows);
  assert.equal(result.status,"HOLD");
  assert.equal(result.completeDays,1);
  assert.ok(result.reasons.some(reason => reason.includes("集中")));
  assert.ok(repeatRiskEvidenceGate(rows,true).reasons.some(reason => reason.includes("打ち切られ")));
});

test("evidence gate reports pending outcome and cohort completion imbalance", () => {
 const rows=[{trade_date:"2026-10-19",previous_candidate_drop_over_5pct:true,previous_candidate_change_pct:-6,return_5d:-8},{trade_date:"2026-10-23",previous_candidate_drop_over_5pct:true,previous_candidate_change_pct:-6,return_5d:null},{trade_date:"2026-10-19",previous_candidate_drop_over_5pct:false,previous_candidate_change_pct:0,return_5d:1}];
 const result=repeatRiskEvidenceGate(rows);
 assert.equal(result.status,"HOLD");
 assert.ok(result.reasons.some(reason => reason.includes("未確定")));
 assert.ok(result.reasons.some(reason => reason.includes("完了率")));
});

test("evidence gate requires risk results from multiple independent decision dates", () => {
 const rows=Array.from({length:35},(_,i)=>({trade_date:"2026-10-19",previous_candidate_drop_over_5pct:true,previous_candidate_change_pct:-6,return_5d:-i}));
 const result=repeatRiskEvidenceGate(rows);
 assert.equal(result.status,"HOLD");
 assert.ok(result.reasons.some(reason=>reason.includes("評価済み取引日が5日未満")));
 assert.equal(result.dominantShare,100);
});

test("evidence checklist describes outstanding validation and never unlocks trading", () => {
 const rows=[{trade_date:"2026-10-19",previous_candidate_drop_over_5pct:true,previous_candidate_change_pct:-6,return_5d:-8},{trade_date:"2026-10-19",previous_candidate_drop_over_5pct:false,previous_candidate_change_pct:0,return_5d:1}];
 const result=repeatRiskEvidenceGate(rows);
 assert.equal(result.status,"HOLD");
 assert.equal(result.followUp.length,4);
 assert.equal(result.followUp[0].ready,false);
 assert.ok(result.followUp.some(x=>x.task.includes("取引日") && x.ready===false));
});

test("discarded dated outcomes remain visible as independent HOLD reasons", () => {
 const rows=[{trade_date:"2026-10-19",previous_candidate_drop_over_5pct:true,previous_candidate_change_pct:-6,return_5d:null},{trade_date:"2026-10-19",previous_candidate_drop_over_5pct:false,previous_candidate_change_pct:0,return_5d:3}];
 const gate=repeatRiskEvidenceGate(rows,false,1);
 assert.equal(gate.status,"HOLD");
 assert.ok(gate.reasons.some(x=>x.includes("日付不整合") && x.includes("1件")));
 assert.ok(gate.followUp[0].detail.includes("除外 1件"));
 assert.ok(!repeatRiskEvidenceGate(rows,false,0).reasons.some(x=>x.includes("日付不整合によって")));
});

test("exact database classification works even if display change is missing", () => {
 const rows=[{trade_date:"2026-10-19",previous_candidate_change_pct:null,previous_candidate_drop_over_5pct:true,return_5d:-4},{trade_date:"2026-10-19",previous_candidate_change_pct:null,previous_candidate_drop_over_5pct:false,return_5d:1}];
 assert.equal(sameDayComparison(rows).matchedDayCount,1);
 assert.equal(sameDayComparison(rows).dateBalancedGap,-5);
});
test("weekday audit does not normalize impossible calendar dates", () => {
 const rows=[{trade_date:"2026-10-19",outcome_5d_date:"2026-02-30",return_5d:-2},{trade_date:"2026-10-19",outcome_5d_date:"2026-10-26",return_5d:1}];
 assert.deepEqual(weekdayGapAudit(rows),{assessed:1,weekdayMismatch:0,insufficientCalendarEvidence:1});
});
