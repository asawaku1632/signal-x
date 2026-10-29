import test from "node:test";import assert from "node:assert/strict";
import {auditProspectiveCalendarStrata as run} from "../app/lib/research/prospectiveCalendarStrata.mjs";
const rows=[{date:"2026-10-30",highCount:10,lowCount:10,gapPp:2},{date:"2026-11-02",highCount:20,lowCount:20,gapPp:-3},{date:"2026-11-04",highCount:10,lowCount:10,gapPp:1}];
test("monthly equal-date averages and sign counts",()=>{const x=run(rows);assert.equal(x.qualifyingMonths,2);assert.deepEqual(x.months.map(m=>m.meanGapPp),[2,-1]);assert.equal(x.positiveMeanMonths,1);assert.equal(x.actualMarketRegimeKnown,false);});
test("small cohorts cannot establish month",()=>assert.equal(run([{...rows[0],highCount:9}]).qualifyingMonths,0));
test("duplicate days rejected rather than silently double-counted",()=>assert.throws(()=>run([rows[0],rows[0]]),/DUPLICATE/));
test("invalid calendar day rejected",()=>assert.throws(()=>run([{...rows[0],date:"2026-11-31"}]),/STRATA_DATE/));
test("input validation and no training approval",()=>{assert.throws(()=>run(null),/INVALID_CALENDAR_STRATA/);assert.equal(run(rows).readyForTraining,false);});

test("one or two favorable days do not qualify as an adequately sampled month",()=>{
 const result=run(rows);
 assert.equal(result.positiveMeanMonths,1);
 assert.equal(result.sufficientlyObservedMonths,0);
 assert.equal(result.positiveSufficientMonths,0);
 assert.equal(result.minDatesPerMonth,5);
 assert.equal(result.months.every(m=>m.sufficientDates===false),true);
 assert.equal(result.readyForTraining,false);
});
test("minimum monthly sample gate is configurable without redefining calendar months",()=>{
 const result=run(rows,{minDatesPerMonth:2});
 assert.equal(result.sufficientlyObservedMonths,1);
 assert.equal(result.positiveSufficientMonths,0);
 assert.equal(result.months.find(m=>m.month==="2026-11").sufficientDates,true);
 assert.throws(()=>run(rows,{minDatesPerMonth:0}),/INVALID_MONTH_SAMPLE_GATE/);
});

test("a single large positive day cannot hide a majority of negative days",()=>{
 const days=[1,2,3,4,5].map((d,i)=>({date:`2026-12-0${d}`,highCount:10,lowCount:10,gapPp:i===0?20:-1}));
 const report=run(days);
 assert.equal(report.sufficientlyObservedMonths,1);
 assert.equal(report.positiveSufficientMonths,1);
 assert.equal(report.majorityPositiveSufficientMonths,0);
 assert.equal(report.months[0].positiveDates,1);
 assert.equal(report.months[0].positiveDateShare,0.2);
 assert.equal(report.months[0].majorityPositive,false);
 assert.equal(report.readyForTrading,false);
});

test("monthly median exposes a single outsized positive day",()=>{
 const days=[1,2,3,4,5].map((d,i)=>({date:`2026-12-0${d}`,highCount:10,lowCount:10,gapPp:i===0?20:-1}));
 const report=run(days);
 assert.equal(report.months[0].meanGapPp,3.2);
 assert.equal(report.months[0].medianGapPp,-1);
 assert.equal(report.months[0].majorityPositive,false);
 assert.equal(report.readyForTrading,false);
});

test("excluded days are accounted for rather than vanishing from calendar evidence",()=>{
 const data=[...rows,{date:"2026-11-05",highCount:9,lowCount:10,gapPp:100}];
 const report=run(data);
 assert.equal(report.receivedDates,4);
 assert.equal(report.excludedDates,1);
 assert.equal(report.qualifyingDates,3);
 assert.equal(report.readyForTraining,false);
});
test("monthly positive mean can conflict with negative median without model approval",()=>{
 const days=[1,2,3,4,5].map((d,i)=>({date:`2026-12-0${d}`,highCount:10,lowCount:10,gapPp:i===0?20:-1}));
 const report=run(days);
 assert.equal(report.conflictingMeanMedianMonths,1);
 assert.equal(report.medianPositiveSufficientMonths,0);
 assert.equal(report.positiveSufficientMonths,1);
 assert.equal(report.readyForTrading,false);
});

test("excluded cohort reasons distinguish insufficient groups and invalid gap",()=>{
 const bad=[
  {date:"2026-12-01",highCount:9,lowCount:10,gapPp:1},
  {date:"2026-12-02",highCount:10,lowCount:9,gapPp:2},
  {date:"2026-12-03",highCount:10,lowCount:10,gapPp:NaN},
  {date:"2026-12-04",highCount:9,lowCount:9,gapPp:NaN}
 ];
 const report=run(bad);
 assert.equal(report.receivedDates,4);
 assert.equal(report.excludedDates,4);
 assert.deepEqual(report.exclusionReasons,{insufficientHigh:2,insufficientLow:2,invalidGap:2});
 assert.equal(report.qualifyingDates,0);
 assert.equal(report.readyForTraining,false);
});

test("primary exclusion categories reconcile even when a date has multiple failures",()=>{
 const bad=[
  {date:"2026-12-01",highCount:9,lowCount:9,gapPp:NaN},
  {date:"2026-12-02",highCount:10,lowCount:9,gapPp:NaN},
  {date:"2026-12-03",highCount:10,lowCount:10,gapPp:NaN}
 ];
 const report=run(bad);
 assert.equal(report.excludedDates,3);
 assert.deepEqual(report.primaryExclusionReasons,{insufficientHigh:1,insufficientLow:1,invalidGap:1});
 assert.equal(Object.values(report.primaryExclusionReasons).reduce((sum,n)=>sum+n,0),report.excludedDates);
 assert.equal(report.readyForTraining,false);
});

test("cross-month consistency requires two supported months, and stays descriptive",()=>{
 const makeMonth=(month,gaps)=>gaps.map((gap,i)=>({date:`${month}-${String(i+1).padStart(2,"0")}`,highCount:10,lowCount:10,gapPp:gap}));
 const one=run(makeMonth("2026-11",[1,2,3,4,5]));
 assert.equal(one.descriptiveMonthlyConsistency.allSupportedMonthsConsistent,false);
 const both=run([...makeMonth("2026-11",[1,2,3,4,5]),...makeMonth("2026-12",[1,2,3,4,5])]);
 assert.equal(both.descriptiveMonthlyConsistency.supportedMonths,2);
 assert.equal(both.descriptiveMonthlyConsistency.meanMedianAndMajorityPositiveMonths,2);
 assert.equal(both.descriptiveMonthlyConsistency.allSupportedMonthsConsistent,true);
 assert.equal(both.descriptiveMonthlyConsistency.independentlyValidated,false);
 assert.equal(both.readyForTraining,false);
 assert.equal(both.readyForTrading,false);
 const mixed=run([...makeMonth("2026-11",[1,2,3,4,5]),...makeMonth("2026-12",[20,-1,-1,-1,-1])]);
 assert.equal(mixed.descriptiveMonthlyConsistency.allSupportedMonthsConsistent,false);
});

test("uneven months are flagged even when both monthly means look positive",()=>{
 const dates=(month,count)=>Array.from({length:count},(_,i)=>({date:`${month}-${String(i+1).padStart(2,"0")}`,highCount:10,lowCount:10,gapPp:1}));
 const report=run([...dates("2026-11",15),...dates("2026-12",5)]);
 assert.equal(report.descriptiveMonthlyConsistency.supportedMonths,2);
 assert.equal(report.descriptiveMonthlyConsistency.supportedTradingDates,20);
 assert.equal(report.descriptiveMonthlyConsistency.largestMonthDateShare,0.75);
 assert.equal(report.descriptiveMonthlyConsistency.concentratedInOneMonth,true);
 assert.equal(report.descriptiveMonthlyConsistency.allSupportedMonthsConsistent,true);
 assert.equal(report.descriptiveMonthlyConsistency.independentlyValidated,false);
 assert.equal(report.readyForTrading,false);
 const balanced=run([...dates("2026-11",5),...dates("2026-12",5)]);
 assert.equal(balanced.descriptiveMonthlyConsistency.concentratedInOneMonth,false);
});

test("calendar breadth is not established by two uniformly positive but concentrated months",()=>{
 const dates=(month,count)=>Array.from({length:count},(_,i)=>({date:`${month}-${String(i+1).padStart(2,"0")}`,highCount:10,lowCount:10,gapPp:1}));
 const concentrated=run([...dates("2026-11",15),...dates("2026-12",5)]);
 assert.equal(concentrated.descriptiveMonthlyConsistency.allSupportedMonthsConsistent,true);
 assert.equal(concentrated.descriptiveMonthlyConsistency.breadthWithoutSingleMonthConcentration,false);
 assert.equal(concentrated.readyForTraining,false);
 const balanced=run([...dates("2026-11",5),...dates("2026-12",5)]);
 assert.equal(balanced.descriptiveMonthlyConsistency.breadthWithoutSingleMonthConcentration,true);
 assert.equal(balanced.descriptiveMonthlyConsistency.independentlyValidated,false);
 assert.equal(balanced.readyForTrading,false);
});
