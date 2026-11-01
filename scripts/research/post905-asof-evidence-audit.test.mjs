import test from 'node:test';
import assert from 'node:assert/strict';
import {auditAsOf905Evidence} from '../../app/lib/research/post905AsOfEvidenceAudit.mjs';
const report={code:'1301',date:'2026-10-30',post905:{
 code:'1301',date:'2026-10-30',hindsightOnly:true,
 eligibleForProduction:false,eligibleForNotifications:false}};
const evidence={code:'1301',date:'2026-10-30',source:'independent-test-capture',
 independentCapture:true,lastInputBarEndAt:'2026-10-30T09:05:00+09:00',
 receivedAt:'2026-10-30T09:05:00+09:00',
 generatedAt:'2026-10-30T09:05:00+09:00'};
test('absent evidence never becomes a 09:05 verified signal',()=>{
 const x=auditAsOf905Evidence(report,null);
 assert.equal(x.captureEvidenceChronologicallyComplete,false);
 assert.equal(x.eligibleForProduction,false);
});
test('later received or generated evidence fails closed',()=>{
 for(const field of ['receivedAt','generatedAt']){
  const x=auditAsOf905Evidence(report,{...evidence,[field]:'2026-10-30T09:05:01+09:00'});
  assert.equal(x.captureEvidenceChronologicallyComplete,false);
 }
});
test('wrong symbol and untrusted capture fail closed',()=>{
 assert.equal(auditAsOf905Evidence(report,{...evidence,code:'1332'}).captureEvidenceChronologicallyComplete,false);
 assert.equal(auditAsOf905Evidence(report,{...evidence,independentCapture:false}).captureEvidenceChronologicallyComplete,false);
});
test('timely independent evidence alone does not prove trading edge',()=>{
 const x=auditAsOf905Evidence(report,evidence);
 assert.equal(x.captureEvidenceChronologicallyComplete,true);
 assert.ok(x.blockers.includes('NO_INDEPENDENT_SIGNAL_REPLAY'));
 assert.equal(x.verifiedTradingEdge,false);
 assert.equal(x.eligibleForNotifications,false);
});
