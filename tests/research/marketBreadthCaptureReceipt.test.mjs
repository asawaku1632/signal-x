import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMarketBreadthCaptureReceipt as receipt,hashMarketBreadthSnapshotRecord as hash} from '../../lib/research/marketBreadthCaptureReceipt.mjs';
const sourceRecord={recordId:'source:20261028:641A',code:'641A',observedAt:'2026-10-28T09:01:00+09:00',barEndAt:'2026-10-28T09:00:00+09:00'};
const snapshotRecord={recordId:'snapshot:20261028:001',updatedAt:'2026-10-28T09:06:00+09:00',stocks:[{code:'641A',price:100}]};
const envelope={schemaVersion:'market-breadth-capture-envelope-v1',signalRecordId:'signal:20261028:641A',snapshotRecordId:snapshotRecord.recordId,sourceRecordId:sourceRecord.recordId,code:'641A',tradeDate:'2026-10-28',barEndAt:sourceRecord.barEndAt,sourceObservedAt:sourceRecord.observedAt,signalGeneratedAt:'2026-10-28T09:05:00+09:00',snapshotUpdatedAt:snapshotRecord.updatedAt,recordedAt:'2026-10-28T09:07:00+09:00',signalGeneratedAtOrigin:'INDEPENDENT_GENERATOR_RECORD',originalRecordVerified:true,providerRightsVerified:true,provider:'licensed-source',licenseRecordId:'license:verified:01',snapshotHash:hash(snapshotRecord)};
test('matching independent source and snapshot records yield research-only receipt',()=>{const x=receipt(envelope,{sourceRecord,snapshotRecord});assert.equal(x.accepted,true);assert.equal(x.productionEligible,false)});
test('canonical hashing ignores object key insertion order',()=>{assert.equal(hash(snapshotRecord),hash({stocks:snapshotRecord.stocks,updatedAt:snapshotRecord.updatedAt,recordId:snapshotRecord.recordId}))});
test('tampered price invalidates snapshot receipt',()=>{const x=receipt(envelope,{sourceRecord,snapshotRecord:{...snapshotRecord,stocks:[{code:'641A',price:101}]}});assert.equal(x.reason,'SNAPSHOT_HASH_MISMATCH')});
test('different source identity cannot be substituted',()=>{const x=receipt(envelope,{sourceRecord:{...sourceRecord,recordId:'source:another:641A'},snapshotRecord});assert.equal(x.reason,'SOURCE_RECORD_BINDING_MISMATCH')});
test('later observation cannot be silently substituted',()=>{const x=receipt(envelope,{sourceRecord:{...sourceRecord,observedAt:'2026-10-28T09:02:00+09:00'},snapshotRecord});assert.equal(x.reason,'SOURCE_TIME_BINDING_MISMATCH')});
test('missing source is blocked',()=>{assert.equal(receipt(envelope,{snapshotRecord}).reason,'IMMUTABLE_SOURCE_RECORDS_MISSING')});
test('noncanonical values are rejected',()=>{assert.equal(receipt(envelope,{sourceRecord,snapshotRecord:{...snapshotRecord,stocks:[undefined]}}).reason,'SNAPSHOT_CANONICALIZATION_FAILED')});

test('source security must match captured code',()=>{const x=receipt(envelope,{sourceRecord:{...sourceRecord,code:'590A'},snapshotRecord});assert.equal(x.reason,'SOURCE_SECURITY_BINDING_MISMATCH')});

test('internal source binding never asserts independent external attestation',()=>{const x=receipt(envelope,{sourceRecord,snapshotRecord});assert.equal(x.accepted,true);assert.equal(x.sourceRecordBindingVerified,true);assert.equal(x.externalSourceAttestationVerified,false);assert.equal(Object.hasOwn(x,'sourceRecordVerifiedExternally'),false)});
