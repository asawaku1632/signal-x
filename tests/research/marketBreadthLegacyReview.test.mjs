import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewMarketBreadthLegacyData as review} from '../../lib/research/marketBreadthLegacyReview.mjs';
const bb={id:1,signal_date:'2026-08-10',created_at:'2026-08-11T10:50:17Z',entry_price:100};
const result={event_id:1,horizon:5,evaluated_trade_date:'2026-08-18',future_price:105,return_percent:5};
test('linked legacy five-day outcome is not verified evidence',()=>{const x=review({bbEvents:[bb],bbResults:[result]});assert.equal(x.inventory.signalCount,1);assert.equal(x.inventory.resultCount,1);assert.equal(x.fiveDayLinkedUnverified,1);assert.equal(x.verifiedFiveDayOutcomes,0);assert.equal(x.verifiedProspectiveSignals,0);assert.equal(x.productionEligible,false);assert.equal(x.notificationEligible,false)});
test('other horizons cannot inflate five-day outcome count',()=>{const x=review({bbEvents:[bb],bbResults:[{...result,horizon:10}]});assert.equal(x.fiveDayLinkedUnverified,0);assert.equal(x.outcomes.bb.counts.INVALID_HORIZON,1)});
test('empty review is safe and remains blocked',()=>{const x=review();assert.equal(x.inventory.signalCount,0);assert.equal(x.forwardEvidenceEligible,false)});
test('invalid input cannot pass review',()=>assert.throws(()=>review({bbEvents:'invalid'}),/INVALID_LEGACY_INVENTORY/));
