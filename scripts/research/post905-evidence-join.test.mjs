import test from 'node:test';
import assert from 'node:assert/strict';
import {joinEvidence,loadEvidence} from './post905-evidence-join.mjs';
const report={code:'1301',date:'2026-10-30',post905:{code:'1301',date:'2026-10-30',
 hindsightOnly:true,eligibleForProduction:false,eligibleForNotifications:false}};
const evidence={code:'1301',date:'2026-10-30',source:'independent-test-capture',
 independentCapture:true,lastInputBarEndAt:'2026-10-30T09:05:00+09:00',
 receivedAt:'2026-10-30T09:05:00+09:00',generatedAt:'2026-10-30T09:05:00+09:00'};
test('missing evidence remains unverified',()=>{
 const x=joinEvidence([report]);
 assert.equal(x.withEvidence,0);
 assert.equal(x.chronologicallyComplete,0);
 assert.equal(x.eligibleForProduction,false);
});
test('sidecar evidence only proves timestamp ordering, not edge',()=>{
 const x=joinEvidence([report],new Map([['1301|2026-10-30',evidence]]));
 assert.equal(x.chronologicallyComplete,1);
 assert.equal(x.verifiedTradingEdge,false);
 assert.equal(x.items[0].eligibleForNotifications,false);
});
test('orphan evidence fails closed',()=>{
 assert.throws(()=>joinEvidence([report],new Map([['1332|2026-10-30',evidence]])));
});
test('evidence loader rejects filename scope mismatch',()=>{
 const listing=()=>['1301_2026-10-30.json','summary.json'];
 assert.equal(loadEvidence('unused',listing,()=>JSON.stringify(evidence)).size,1);
 assert.throws(()=>loadEvidence('unused',listing,()=>JSON.stringify({...evidence,code:'1332'})));
});
