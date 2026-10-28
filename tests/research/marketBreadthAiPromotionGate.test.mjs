import test from 'node:test';
import assert from 'node:assert/strict';
import {assessMarketBreadthAiPromotionCandidates as assess} from '../../lib/research/marketBreadthAiPromotionGate.mjs';
const signal={signalRecordId:'signal:20261028:641A',sourceRecordId:'source:20261028:641A',code:'641A',signalGeneratedAt:'2026-10-28T09:05:00+09:00',sourceObservedAt:'2026-10-28T09:01:00+09:00',sourceBarEndAt:'2026-10-28T09:00:00+09:00',provider:'provider-unverified',licenseRecordId:'license:review:001',payload:{aiPower:55}};
const sourceRecord={recordId:signal.sourceRecordId,code:signal.code,observedAt:signal.sourceObservedAt,barEndAt:signal.sourceBarEndAt};
test('empty assessment cannot authorize promotion',()=>{const r=assess();assert.equal(r.aiPromotionAuthorized,false);assert.equal(r.eligibleCount,0);assert.equal(r.candidates.length,0)});
test('valid internal prospective signal is not AI eligible',()=>{const r=assess({prospectiveEntries:[{signal,sourceRecord}]});assert.equal(r.candidates[0].classification,'EVIDENCE_INCOMPLETE');assert.equal(r.candidates[0].eligibleForAiPromotion,false);assert.equal(r.candidates[0].eligibleForNotification,false)});
test('duplicate signal IDs do not inflate candidate counts',()=>{const r=assess({prospectiveEntries:[{signal,sourceRecord},{signal,sourceRecord}]});assert.equal(r.candidates.length,1);assert.equal(r.audit.counts.preflightAccepted,0)});
test('invalid source binding is not silently promoted',()=>{const r=assess({prospectiveEntries:[{signal,sourceRecord:{...sourceRecord,code:'590A'}}]});assert.equal(r.aiPromotionAuthorized,false);assert.equal(r.audit.counts.preflightRejected,1)});
