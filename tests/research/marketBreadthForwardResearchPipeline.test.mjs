import test from 'node:test';
import assert from 'node:assert/strict';
import {hashMarketBreadthSnapshotRecord} from '../../lib/research/marketBreadthCaptureReceipt.mjs';
import {runMarketBreadthForwardResearchPipeline as run} from '../../lib/research/marketBreadthForwardResearchPipeline.mjs';
const sourceRecord={recordId:'source:20261028:641A',code:'641A',observedAt:'2026-10-28T09:01:00+09:00',barEndAt:'2026-10-28T09:00:00+09:00'};
const snapshotRecord={recordId:'snapshot:20261028:001',updatedAt:'2026-10-28T09:06:00+09:00',stocks:[{code:'641A',price:100}]};
const envelope={schemaVersion:'market-breadth-capture-envelope-v1',signalRecordId:'signal:20261028:641A',snapshotRecordId:snapshotRecord.recordId,sourceRecordId:sourceRecord.recordId,code:'641A',tradeDate:'2026-10-28',barEndAt:sourceRecord.barEndAt,sourceObservedAt:sourceRecord.observedAt,signalGeneratedAt:'2026-10-28T09:05:00+09:00',snapshotUpdatedAt:snapshotRecord.updatedAt,recordedAt:'2026-10-28T09:07:00+09:00',signalGeneratedAtOrigin:'INDEPENDENT_GENERATOR_RECORD',originalRecordVerified:true,providerRightsVerified:true,provider:'licensed-source',licenseRecordId:'license:verified:01',snapshotHash:hashMarketBreadthSnapshotRecord(snapshotRecord)};
const row={tradeDate:'2026-10-28',code:'641A',marketObservedAt:'2026-10-28T09:01:00+09:00',signalGeneratedAt:envelope.signalGeneratedAt,evaluatedAt:'2026-11-05T15:30:00+09:00',outcomeDate:'2026-11-05',horizonTradingDays:5,marketStatus:'INDEX_BREADTH_DIVERGENCE',return5dPct:2};
const evidence={signalRecordId:envelope.signalRecordId,marketRecordId:'market:20261028:001',outcomeRecordId:'outcome:20261105:641A',tradeDate:row.tradeDate,code:row.code,marketObservedAt:row.marketObservedAt,evaluatedAt:row.evaluatedAt,signalProvenanceVerified:true,signalGeneratedAt:row.signalGeneratedAt,marketStatusVerified:true,marketStatus:row.marketStatus,marketLicenseVerified:true,outcomeLicenseVerified:true,marketProvider:'licensed-market',outcomeProvider:'licensed-outcome',fiveTseSessionsVerified:true,outcomePriceVerified:true,verifiedReturn5dPct:2,outcomeDate:row.outcomeDate};
const entry={envelope,sourceRecord,snapshotRecord,row,evidence};
test('offline pipeline links independently attested fixture without production promotion',()=>{const x=run([entry]);assert.equal(x.linkedCount,1);assert.equal(x.review.report.acceptedEvidenceCount,1);assert.equal(x.productionEligible,false);assert.equal(x.notificationEligible,false)});
test('unverified source is rejected before outcome review',()=>{const x=run([{...entry,envelope:{...envelope,originalRecordVerified:false}}]);assert.equal(x.linkedCount,0);assert.equal(x.rejected[0].reason,'INDEPENDENT_SIGNAL_PROOF_MISSING')});
test('tampered snapshot blocks linkage',()=>{const x=run([{...entry,snapshotRecord:{...snapshotRecord,stocks:[{code:'641A',price:999}]}}]);assert.equal(x.linkedCount,0);assert.equal(x.rejected[0].reason,'SNAPSHOT_HASH_MISMATCH')});
test('duplicate signal is not double-counted',()=>{const x=run([entry,{...entry}]);assert.equal(x.linkedCount,0);assert.equal(x.rejected.length,2);assert.equal(x.review.report.acceptedEvidenceCount,0);assert.ok(x.rejected.every(r=>r.reason==='DUPLICATE_FORWARD_EVIDENCE'))});
test('empty input is never promotion eligible',()=>{const x=run([]);assert.equal(x.linkedCount,0);assert.equal(x.review.report.acceptedEvidenceCount,0);assert.equal(x.productionEligible,false)});
test('invalid input is rejected',()=>{assert.throws(()=>run(null),/INVALID_FORWARD_ENTRIES/);assert.equal(run([null]).rejected[0].reason,'INVALID_FORWARD_ENTRY')});

test('reused outcome ID across distinct signals quarantines both',()=>{
 const second={...entry,envelope:{...envelope,signalRecordId:'signal:20261028:590A',code:'590A'},row:{...row,code:'590A'},evidence:{...evidence,signalRecordId:'signal:20261028:590A',code:'590A'}};
 const x=run([entry,second]);assert.equal(x.linkedCount,0);assert.equal(x.rejected.length,2);assert.equal(x.review.report.acceptedEvidenceCount,0);
});

test('source security mismatch blocks entire research pipeline',()=>{const x=run([{...entry,sourceRecord:{...sourceRecord,code:'590A'}}]);assert.equal(x.linkedCount,0);assert.equal(x.rejected[0].reason,'SOURCE_SECURITY_BINDING_MISMATCH')});
