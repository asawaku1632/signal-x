import test from 'node:test';
import assert from 'node:assert/strict';
import {auditMarketBreadthObservationCohort as audit} from '../../lib/research/marketBreadthObservationCohortAudit.mjs';
const r=(code='9983',ret=-3.06)=>({code,tradeDate:'2026-08-21',evaluatedTradeDate:'2026-08-28',returnPercent:ret,horizon:5,horizonUnit:'TRADING_DAY'});
test('two event types for one stock date count once',()=>{const x=audit({rows:[r(),r()]});assert.equal(x.counts.validStockDateObservations,1);assert.equal(x.counts.collapsedSameStockDateEvents,1)});
test('different stocks remain independent stock-date observations',()=>{const x=audit({rows:[r(),r('9432',1.5)]});assert.equal(x.counts.validStockDateObservations,2);assert.equal(x.counts.distinctTradeDates,1)});
test('conflicting stock-date outcomes quarantine the group',()=>{const x=audit({rows:[r(),r('9983',5)]});assert.equal(x.counts.validStockDateObservations,0);assert.equal(x.counts.conflictingGroups,1)});
test('invalid chronology is rejected',()=>{const x=audit({rows:[{...r(),evaluatedTradeDate:'2026-08-20'}]});assert.equal(x.counts.rejectedRows,1)});
test('other horizons are excluded',()=>{const x=audit({rows:[{...r(),horizon:1}]});assert.equal(x.counts.validStockDateObservations,0)});

test('calendar-day horizon is not a five-trading-day outcome',()=>{const x=audit({rows:[{...r(),horizonUnit:'CALENDAR_DAY'}]});assert.equal(x.counts.validStockDateObservations,0)});

test('same stock and signal date but different evaluation dates are quarantined',()=>{const x=audit({rows:[r(),{...r(),evaluatedTradeDate:'2026-09-01'}]});assert.equal(x.counts.validStockDateObservations,0);assert.equal(x.counts.conflictingGroups,1)});
test('identical stock/date/return and evaluation day can collapse',()=>{const x=audit({rows:[r(),r()]});assert.equal(x.accepted[0].evaluatedTradeDate,'2026-08-28')});

test('loss below minus one hundred percent is invalid',()=>{const x=audit({rows:[r('9983',-101)]});assert.equal(x.counts.rejectedRows,1)});
test('total loss of exactly minus one hundred percent is allowed descriptively',()=>{const x=audit({rows:[r('9983',-100)]});assert.equal(x.counts.validStockDateObservations,1)});
test('non-finite return is excluded',()=>{const x=audit({rows:[r('9983',Infinity)]});assert.equal(x.counts.rejectedRows,1)});
test('invalid stock code is excluded',()=>{const x=audit({rows:[r('__DEV_FIXTURE__')]});assert.equal(x.counts.rejectedRows,1)});
test('invalid calendar date is excluded',()=>{const x=audit({rows:[{...r(),tradeDate:'2026-02-30'}]});assert.equal(x.counts.rejectedRows,1)});
test('empty input stays research only',()=>{const x=audit();assert.equal(x.counts.validStockDateObservations,0);assert.equal(x.aiPromotionAuthorized,false)});
test('multiple trade dates are counted independently',()=>{const x=audit({rows:[r(),{...r(),tradeDate:'2026-08-28',evaluatedTradeDate:'2026-09-04'}]});assert.equal(x.counts.distinctTradeDates,2)});
test('null row is rejected safely',()=>{const x=audit({rows:[null]});assert.equal(x.counts.rejectedRows,1)});
test('non-array input is rejected safely',()=>{assert.throws(()=>audit({rows:{}}),/INVALID_OBSERVATION_COHORT/)});

test('descriptive statistics count each stock/date only once',()=>{const x=audit({rows:[r('9983',-3),r('9983',-3),r('9432',1)]});assert.equal(x.counts.validStockDateObservations,2);assert.equal(x.counts.distinctStockCodes,2);assert.equal(x.descriptiveStats.meanReturnPercent,-1);assert.equal(x.descriptiveStats.medianReturnPercent,-1);assert.equal(x.descriptiveStats.positiveRate,0.5)});
test('empty cohort has null descriptive statistics, not zero performance',()=>{const x=audit();assert.equal(x.descriptiveStats.meanReturnPercent,null);assert.equal(x.descriptiveStats.medianReturnPercent,null);assert.equal(x.descriptiveStats.positiveRate,null)});
test('conflicting cohort does not enter descriptive statistics',()=>{const x=audit({rows:[r('9983',-3),r('9983',3)]});assert.equal(x.descriptiveStats.meanReturnPercent,null)});
test('median of three distinct observations is central return',()=>{const x=audit({rows:[r('9983',-3),r('9432',1),r('8591',2)]});assert.equal(x.descriptiveStats.medianReturnPercent,1)});

test('by-date summary separates observation dates',()=>{const x=audit({rows:[r('9983',-3),r('9432',1),{...r('9983',2),tradeDate:'2026-08-28',evaluatedTradeDate:'2026-09-04'}]});assert.equal(x.byDate.length,2);assert.deepEqual(x.byDate.map(d=>d.stockDateCount),[2,1]);assert.deepEqual(x.byDate.map(d=>d.meanReturnPercent),[-1,2]);assert.deepEqual(x.byDate.map(d=>d.positiveRate),[0.5,1])});
test('empty by-date summary is empty, not fabricated',()=>{assert.deepEqual(audit().byDate,[])});
test('event-type duplicates do not inflate daily denominator',()=>{const x=audit({rows:[r('9983',-3),r('9983',-3),r('9432',1)]});assert.equal(x.byDate[0].stockDateCount,2)});

test('equal-date mean prevents large dates from dominating date-level summary',()=>{const x=audit({rows:[r('9983',-3),r('9432',-3),r('8591',-3),{...r('9983',9),tradeDate:'2026-08-28',evaluatedTradeDate:'2026-09-04'}]});assert.equal(x.descriptiveStats.meanReturnPercent,0);assert.equal(x.descriptiveStats.equalDateMeanReturnPercent,3)});
test('empty equal-date mean is null',()=>{assert.equal(audit().descriptiveStats.equalDateMeanReturnPercent,null)});
test('one-date equal-date mean equals ordinary mean',()=>{const x=audit({rows:[r('9983',-3),r('9432',1)]});assert.equal(x.descriptiveStats.equalDateMeanReturnPercent,-1)});

test('leave-one-date-out flags opposing signs across dates',()=>{const x=audit({rows:[r('9983',-3),{...r('9432',2),tradeDate:'2026-08-28',evaluatedTradeDate:'2026-09-04'}]});assert.equal(x.leaveOneDateOut.length,2);assert.deepEqual(x.leaveOneDateOut.map(v=>v.signAgreement),[false,false]);assert.equal(x.aiPromotionAuthorized,false)});
test('single date cannot support leave-one-date-out analysis',()=>{assert.deepEqual(audit({rows:[r()]}).leaveOneDateOut,[])});
test('empty dataset cannot support leave-one-date-out analysis',()=>{assert.deepEqual(audit().leaveOneDateOut,[])});
test('same direction across dates remains descriptive only',()=>{const x=audit({rows:[r('9983',2),{...r('9432',3),tradeDate:'2026-08-28',evaluatedTradeDate:'2026-09-04'}]});assert.deepEqual(x.leaveOneDateOut.map(v=>v.signAgreement),[true,true]);assert.equal(x.independentImprovementVerified,false)});

test('two-date sensitivity is explicitly insufficient evidence',()=>{const x=audit({rows:[r(),{...r(),tradeDate:'2026-08-28',evaluatedTradeDate:'2026-09-04'}]});assert.equal(x.sensitivity.insufficientDates,true);assert.equal(x.sensitivity.leaveOneDateOutComparable,false)});
test('three-date sensitivity remains descriptive, not promotion',()=>{const x=audit({rows:[r(),{...r(),tradeDate:'2026-08-28',evaluatedTradeDate:'2026-09-04'},{...r(),tradeDate:'2026-09-04',evaluatedTradeDate:'2026-09-11'}]});assert.equal(x.sensitivity.insufficientDates,false);assert.equal(x.sensitivity.reason,'DESCRIPTIVE_ONLY');assert.equal(x.aiPromotionAuthorized,false)});
