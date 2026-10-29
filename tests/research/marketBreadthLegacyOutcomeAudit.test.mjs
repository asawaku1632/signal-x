import test from 'node:test';
import assert from 'node:assert/strict';
import {auditLegacyOutcomeLinks as audit} from '../../lib/research/marketBreadthLegacyOutcomeAudit.mjs';
const event={id:1,signal_date:'2026-08-10',entry_price:100};
const result={event_id:1,horizon:5,evaluated_trade_date:'2026-08-18',future_price:105,return_percent:5};
test('linked result is explicitly unverified',()=>{const x=audit([event],[result],{kind:'bb'});assert.equal(x.counts.LINKED_UNVERIFIED,1);assert.equal(x.forwardEvidenceEligible,false);assert.equal(x.productionEligible,false)});
test('orphan and duplicate results are quarantined',()=>{const x=audit([event],[{...result,event_id:2},result,{...result}],{kind:'bb'});assert.equal(x.counts.ORPHAN_RESULT,1);assert.equal(x.counts.DUPLICATE_OUTCOME,2);assert.equal(x.counts.LINKED_UNVERIFIED,0)});
test('non-five-day result is not forward-five-day evidence',()=>{const x=audit([event],[{...result,horizon:3}],{kind:'bb'});assert.equal(x.counts.INVALID_HORIZON,1)});
test('invalid price and dates are rejected',()=>{const x=audit([event],[{...result,future_price:0},{...result,event_id:3}],{kind:'bb'});assert.equal(x.counts.INVALID_RETURN,1);assert.equal(x.counts.ORPHAN_RESULT,1)});
test('duplicate event IDs fail closed',()=>{const x=audit([event,{...event}],[result],{kind:'bb'});assert.equal(x.counts.DUPLICATE_EVENT_ID,1)});
test('invalid inputs throw',()=>assert.throws(()=>audit([],[],{kind:'unknown'}),/INVALID_LEGACY_OUTCOME_INPUT/));

test('known DEV fixture is excluded from linked five-day evidence',()=>{const x=audit([{...event,code:'__DEV_BB_TRANSITION_47__',name:'DEV BB 4.7 Fixture'}],[result],{kind:'bb'});assert.equal(x.counts.TEST_FIXTURE_EVENT,1);assert.equal(x.counts.LINKED_UNVERIFIED,0)});
