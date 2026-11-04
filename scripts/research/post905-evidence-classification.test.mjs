import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyHistoricalEvidence} from '../../app/lib/research/post905EvidenceClassification.mjs';
const row={code:'1301',trade_date:'2026-10-30',source_name:'provider',
 source_bar_at:'2026-10-30T09:04:00+09:00',scan_received_at:'2026-10-30T09:04:30+09:00',
 captured_at:'2026-10-30T09:04:50+09:00',capture_status:'ACCEPTED'};
const classify=x=>classifyHistoricalEvidence(x,{code:'1301',date:'2026-10-30'});
test('timely historical record is not an independent live signal',()=>{
 const r=classify(row);assert.equal(r.timestampsWithin905,true);
 assert.equal(r.independentCaptureVerified,false);
 assert.equal(r.eligibleForProduction,false);
});
test('late and reversed timestamps fail closed',()=>{
 for(const patch of [{captured_at:'2026-10-30T09:05:01+09:00'},
  {scan_received_at:'2026-10-30T09:03:00+09:00'}]){
  assert.ok(classify({...row,...patch}).reasons.includes('NOT_AVAILABLE_BY_0905'));
 }
});
test('wrong symbol, source absent, or missing timestamp rejected',()=>{
 assert.ok(classify({...row,code:'1332'}).reasons.includes('SCOPE_MISMATCH'));
 assert.ok(classify({...row,source_name:''}).reasons.includes('SOURCE_UNVERIFIED'));
 assert.ok(classify({...row,source_bar_at:null}).reasons.includes('TIMESTAMP_MISSING_OR_INVALID'));
});
test('unaccepted captures remain excluded',()=>{
 assert.ok(classify({...row,capture_status:'REJECTED'}).reasons.includes('CAPTURE_STATUS_NOT_ACCEPTED'));
});
