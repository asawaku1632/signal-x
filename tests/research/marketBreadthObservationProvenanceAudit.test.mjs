import test from 'node:test';
import assert from 'node:assert/strict';
import {auditMarketBreadthObservationProvenance as audit} from '../../lib/research/marketBreadthObservationProvenanceAudit.mjs';
const row=()=>({tradeDate:'2026-08-21',evaluatedTradeDate:'2026-08-28',barEndAt:'2026-08-21T06:30:00Z',snapshotSavedAt:'2026-08-22T13:45:53Z',evaluatedAt:'2026-08-28T10:03:52Z',returnPercent:1.5,horizon:5,horizonUnit:'TRADING_DAY'});
test('chronological historical sample does not prove independent prediction',()=>{const x=audit({rows:[row()]});assert.equal(x.counts.chronologicallyPlausible,1);assert.equal(x.counts.independentlyVerifiedPredictions,0);assert.equal(x.aiPromotionAuthorized,false)});
test('evaluation before snapshot is rejected',()=>{const x=audit({rows:[{...row(),evaluatedAt:'2026-08-22T12:00:00Z'}]});assert.equal(x.rejected[0].reason,'EVALUATED_BEFORE_SNAPSHOT')});
test('snapshot before bar end rejected',()=>{const x=audit({rows:[{...row(),snapshotSavedAt:'2026-08-21T05:00:00Z'}]});assert.equal(x.rejected[0].reason,'SAVED_BEFORE_BAR_END')});
test('timezone-free timestamps rejected',()=>{const x=audit({rows:[{...row(),barEndAt:'2026-08-21T06:30:00'}]});assert.equal(x.counts.rejectedRows,1)});
test('claimed generation time does not confer external audit',()=>{const x=audit({rows:[{...row(),originalSignalGeneratedAt:'2026-08-21T07:00:00Z'}]});assert.equal(x.counts.independentlyVerifiedPredictions,0)});

test('calendar-day results cannot satisfy trading-day chronology',()=>{const x=audit({rows:[{...row(),horizonUnit:'CALENDAR_DAY'}]});assert.equal(x.counts.chronologicallyPlausible,0)});
