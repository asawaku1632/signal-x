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
