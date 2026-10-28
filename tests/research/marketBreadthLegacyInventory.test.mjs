import test from 'node:test';
import assert from 'node:assert/strict';
import {auditLegacySignalInventory as audit} from '../../lib/research/marketBreadthLegacyInventory.mjs';
const bb={signal_date:'2026-08-10',created_at:'2026-08-11T10:50:17Z'};
const tech={signal_trade_date:'2026-08-14',detected_at:'2026-08-15T11:12:16Z'};
test('inventory counts both cohorts and outcome rows without claiming verified returns',()=>{const x=audit({bbEvents:[bb],technicalEvents:[tech],bbResults:[{event_id:1}]});assert.equal(x.signalCount,2);assert.equal(x.resultCount,1);assert.equal(x.sources.bb.reasons.RETROSPECTIVE_TIMESTAMP_MISMATCH,1);assert.equal(x.sources.technical.reasons.RETROSPECTIVE_TIMESTAMP_MISMATCH,1);assert.equal(x.forwardEvidenceEligible,false);assert.equal(x.productionEligible,false)});
test('empty inventory fails closed',()=>{const x=audit();assert.equal(x.signalCount,0);assert.equal(x.forwardEvidenceEligible,false);assert.ok(x.blockers.includes('LICENSED_MARKET_BREADTH_MISSING'))});
test('invalid inventory types are rejected',()=>assert.throws(()=>audit({bbEvents:{}}),/INVALID_LEGACY_INVENTORY/));
test('input records remain unchanged',()=>{const input={bbEvents:[{...bb}]};const before=JSON.stringify(input);audit(input);assert.equal(JSON.stringify(input),before)});
