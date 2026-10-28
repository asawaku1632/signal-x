import test from 'node:test';
import assert from 'node:assert/strict';
import {partitionMarketBreadthLegacyRecords as partition} from '../../lib/research/marketBreadthLegacyRecordPartition.mjs';
const bb={id:1,code:'641A',signal_date:'2026-08-10',created_at:'2026-08-11T10:50:00Z'};
const technical={id:2,code:'6877',signal_trade_date:'2026-08-14',created_at:'2026-08-16T10:50:00Z'};
test('historical backfills remain descriptive, never verified forward evidence',()=>{const x=partition({bbEvents:[bb],technicalEvents:[technical]});assert.equal(x.counts.descriptive,2);assert.equal(x.counts.verifiedForward,0);assert.equal(x.productionEligible,false)});
test('development fixture is quarantined',()=>{const x=partition({bbEvents:[{...bb,code:'__DEV_BB_TRANSITION_47__'}]});assert.equal(x.counts.quarantined,1);assert.equal(x.quarantined[0].reason,'DEV_OR_INVALID_SECURITY_CODE')});
test('invalid dates are quarantined',()=>{const x=partition({bbEvents:[{...bb,signal_date:'2026-02-30'}]});assert.equal(x.counts.quarantined,1);assert.equal(x.quarantined[0].reason,'INVALID_LEGACY_DATE')});
test('created-at predating nominal trade day is quarantined for investigation',()=>{const x=partition({bbEvents:[{...bb,created_at:'2026-08-09T00:00:00Z'}]});assert.equal(x.quarantined[0].reason,'INCONSISTENT_CREATED_AT')});
test('input must be arrays',()=>{assert.throws(()=>partition({bbEvents:{}}),/INVALID_LEGACY_RECORDS/)});

test('missing or invalid legacy ID is quarantined',()=>{const x=partition({bbEvents:[{...bb,id:null},{...bb,id:0},{...bb,id:'1'}]});assert.equal(x.counts.quarantined,3);assert.ok(x.quarantined.every(item=>item.reason==='INVALID_LEGACY_RECORD_ID'))});
test('impossible leap-day and malformed calendar date are quarantined',()=>{const x=partition({bbEvents:[{...bb,signal_date:'2026-02-29'},{...bb,signal_date:'2026-13-01'}]});assert.equal(x.counts.quarantined,2)});
