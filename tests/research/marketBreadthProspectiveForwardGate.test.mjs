import test from 'node:test';
import assert from 'node:assert/strict';
import {preflightMarketBreadthProspectiveForward as preflight} from '../../lib/research/marketBreadthProspectiveForwardGate.mjs';
const signal={signalRecordId:'signal:20261028:641A',sourceRecordId:'source:20261028:641A',code:'641A',signalGeneratedAt:'2026-10-28T09:05:00+09:00',sourceObservedAt:'2026-10-28T09:01:00+09:00',sourceBarEndAt:'2026-10-28T09:00:00+09:00',provider:'provider-unverified',licenseRecordId:'license:review:001',payload:{aiPower:55}};
const sourceRecord={recordId:signal.sourceRecordId,code:signal.code,observedAt:signal.sourceObservedAt,barEndAt:signal.sourceBarEndAt};
test('internally consistent candidate remains blocked pending independent evidence',()=>{const r=preflight([{signal,sourceRecord}]);assert.equal(r.preflightCandidateCount,1);assert.equal(r.forwardVerifiedCount,0);assert.equal(r.candidates[0].forwardEligible,false);assert.equal(r.candidates[0].missing.length,3);assert.equal(r.productionEligible,false)});
test('duplicate IDs never reach preflight candidates',()=>{const e={signal,sourceRecord};const r=preflight([e,e]);assert.equal(r.preflightCandidateCount,0);assert.equal(r.rejectedCount,2)});
test('source mismatch never reaches preflight candidates',()=>{const r=preflight([{signal,sourceRecord:{...sourceRecord,code:'590A'}}]);assert.equal(r.preflightCandidateCount,0);assert.equal(r.rejected[0].reason,'SOURCE_RECORD_BINDING_MISMATCH')});
test('empty batch has no verified outcome',()=>{const r=preflight([]);assert.equal(r.forwardVerifiedCount,0);assert.equal(r.preflightCandidateCount,0)});
