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
