import test from 'node:test';
import assert from 'node:assert/strict';
import {validateMarketBreadthProspectiveSignalBatch as validate} from '../../lib/research/marketBreadthProspectiveSignalBatch.mjs';
const signal={signalRecordId:'signal:20261028:641A',sourceRecordId:'source:20261028:641A',code:'641A',signalGeneratedAt:'2026-10-28T09:05:00+09:00',sourceObservedAt:'2026-10-28T09:01:00+09:00',sourceBarEndAt:'2026-10-28T09:00:00+09:00',provider:'licensed-provider-pending',licenseRecordId:'license:review:001',payload:{aiPower:55}};
const sourceRecord={recordId:signal.sourceRecordId,code:signal.code,observedAt:signal.sourceObservedAt,barEndAt:signal.sourceBarEndAt};
const entry={signal,sourceRecord};
test('matching source and signal are accepted only for research',()=>{const x=validate([entry]);assert.equal(x.acceptedCount,1);assert.equal(x.productionEligible,false)});
test('duplicate signal IDs quarantine both rows',()=>{const x=validate([entry,{...entry,signal:{...signal,payload:{aiPower:70}}}]);assert.equal(x.acceptedCount,0);assert.equal(x.rejectedCount,2);assert.ok(x.rejected.every(r=>r.reason==='DUPLICATE_SIGNAL_RECORD_ID'))});
test('source security mismatch is rejected',()=>{const x=validate([{...entry,sourceRecord:{...sourceRecord,code:'590A'}}]);assert.equal(x.rejected[0].reason,'SOURCE_RECORD_BINDING_MISMATCH')});
test('source time mismatch is rejected',()=>{const x=validate([{...entry,sourceRecord:{...sourceRecord,observedAt:'2026-10-28T09:02:00+09:00'}}]);assert.equal(x.rejected[0].reason,'SOURCE_RECORD_BINDING_MISMATCH')});
test('missing source record is rejected',()=>{const x=validate([{signal}]);assert.equal(x.rejected[0].reason,'SOURCE_RECORD_MISSING')});
test('empty batch remains safe',()=>{const x=validate([]);assert.equal(x.acceptedCount,0);assert.equal(x.rejectedCount,0)});

test('same source ID and identical source content can serve distinct signals',()=>{const x=validate([entry,{...entry,signal:{...signal,signalRecordId:'signal:20261028:590A'}}]);assert.equal(x.acceptedCount,2);assert.equal(x.rejectedCount,0)});
test('conflicting source contents with same source ID quarantine both signals',()=>{const x=validate([entry,{signal:{...signal,signalRecordId:'signal:20261028:590A'},sourceRecord:{...sourceRecord,price:999}}]);assert.equal(x.acceptedCount,0);assert.equal(x.rejectedCount,2);assert.ok(x.rejected.every(v=>v.reason==='CONFLICTING_SOURCE_RECORD_ID'))});
test('source fingerprint ignores object key order',()=>{const x=validate([entry,{signal:{...signal,signalRecordId:'signal:20261028:590A'},sourceRecord:{barEndAt:sourceRecord.barEndAt,observedAt:sourceRecord.observedAt,code:sourceRecord.code,recordId:sourceRecord.recordId}}]);assert.equal(x.acceptedCount,2);assert.equal(x.accepted[0].sourceHash,x.accepted[1].sourceHash)});
test('malformed source evidence is rejected',()=>{const x=validate([{...entry,sourceRecord:{...sourceRecord,extra:undefined}}]);assert.equal(x.rejected[0].reason,'INVALID_SOURCE_RECORD')});
