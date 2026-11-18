import test from 'node:test';
import assert from 'node:assert/strict';
import {auditMa75ProspectivePath}
 from '../app/lib/research/ma75ProspectivePathAttribution.mjs';
const sha='84bed698421ead22ebbce3fac0cb0aab08505332541acd1316957bb4151f3cab';
function sample(){
 const cases=[
  ['1301',true,true,2,1,-4],
  ['1332',true,true,-2,-3,2],
  ['1333',false,true,1,-1,-2],
  ['1334',false,false,1,2,3]
 ];
 const groups={};
 for(const [h,date] of [
  ['session1','2026-11-12'],
  ['session3','2026-11-16'],
  ['session5','2026-11-18']]){
  groups[h]={exitSession:date,allRequiredOriginalDaysPresent:true,
   groups:{allBreakouts:{frozenGroupCount:4,measured:4,pending:0,quarantined:0}}};
 }
 return {status:'SHADOW_NOT_APPROVED',signalDate:'2026-11-11',
  ownerLocalLockSha256:sha,originalBreakouts:4,originalRisingBreakouts:2,
  originalNonRisingBreakouts:2,eligibleForTrading:false,
  eligibleForProduction:false,eligibleForNotifications:false,horizons:groups,
  perFrozenCodeHorizon:cases.flatMap(([code,risingMA75,budgetEligible,a,b,c])=>
   [a,b,c].map((netReturnPercent,i)=>({code,risingMA75,budgetEligible,
    horizonSessions:[1,3,5][i],netReturnPercent,
    status:'HYPOTHETICAL_OUTCOME_ONLY'})))};
}
test('same frozen codes join across 1/3/5; sign reversals counted',()=>{
 const result=auditMa75ProspectivePath(sample(),{expectedLockSha256:sha,expectedSize:4});
 assert.equal(result.groups.all.count,4);
 assert.deepEqual(result.groups.all.paths,
  {'+++':1,'++-':1,'+-+':0,'+--':1,'-++':0,'-+-':0,'--+':1,'---':0});
 assert.equal(result.groups.all.positiveCount1,3);
 assert.equal(result.groups.all.positiveCount3,2);
 assert.equal(result.groups.all.positiveCount5,2);
 assert.equal(result.groups.all.positive1ToNonpositive5,2);
 assert.equal(result.groups.all.positive3ToNonpositive5,1);
 assert.equal(result.groups.rising.count,2);
 assert.equal(result.groups.nonRising.count,2);
 assert.deepEqual(result.perCode.map(r=>r.code),['1301','1332','1333','1334']);
 assert.equal(result.perCode[0].change3to5,-5);
 assert.equal(result.eligibleForTrading,false);
 assert.equal(result.networkRequests,0);
 assert.equal(result.filesWritten,0);
});
test('output independent of input order',()=>{
 const a=sample(),b=sample();
 b.perFrozenCodeHorizon.reverse();
 assert.deepEqual(auditMa75ProspectivePath(a),auditMa75ProspectivePath(b));
});
test('missing original day, incomplete horizon and missing code fail closed',()=>{
 const a=sample();a.horizons.session5.allRequiredOriginalDaysPresent=false;
 assert.throws(()=>auditMa75ProspectivePath(a),/INCOMPLETE_OR_QUARANTINED_SESSION5/);
 const b=sample();b.perFrozenCodeHorizon.pop();
 assert.throws(()=>auditMa75ProspectivePath(b),/ORIGINAL_MEMBERSHIP_NOT_COMPLETE/);
 const c=sample();c.horizons.session3.groups.allBreakouts.pending=1;
 assert.throws(()=>auditMa75ProspectivePath(c),/INCOMPLETE_OR_QUARANTINED_SESSION3/);
});
test('duplicate, changed subgroup, changed SHA and pending row fail closed',()=>{
 const a=sample();a.perFrozenCodeHorizon[1].horizonSessions=1;
 assert.throws(()=>auditMa75ProspectivePath(a),/DUPLICATE_CODE_HORIZON/);
 const b=sample();b.perFrozenCodeHorizon[0].risingMA75=false;
 assert.throws(()=>auditMa75ProspectivePath(b),/MEMBERSHIP_DRIFT/);
 const c=sample();c.ownerLocalLockSha256='0'.repeat(64);
 assert.throws(()=>auditMa75ProspectivePath(c,{expectedLockSha256:sha}),
  /FROZEN_LOCK_SHA_MISMATCH/);
 const d=sample();d.perFrozenCodeHorizon[0].status='PENDING_REQUIRED_FUTURE_SESSIONS';
 assert.throws(()=>auditMa75ProspectivePath(d),/INVALID_PER_CODE_ROW/);
});
