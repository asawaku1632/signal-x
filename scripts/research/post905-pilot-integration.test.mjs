import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeMinutePilotResult} from './jquants-minute-pilot.mjs';
const minute={code:'1332',date:'2026-10-30',structuralPass:true,pageChainComplete:true,errors:[],observedRawBars:310,asOf905:{close:1090},retrospective:{maximumReboundPercent:1.33826}};
const reconciliation={code:'1332',date:'2026-10-30',structuralOneCodeDayMatched:true,blocked:false,blockers:[]};
const post905={code:'1332',date:'2026-10-30',upsideFromReferencePercent:0.73,eligibleForProduction:false};
test('without daily comparison post905 metrics are withheld',()=>{
 const x=summarizeMinutePilotResult({minute,post905});
 assert.equal(x.post905,null);
 assert.equal(x.metricsReleasedForHistoricalResearch,false);
});
test('matching daily reconciliation releases historical-only outcomes',()=>{
 const x=summarizeMinutePilotResult({minute,reconciliation,compareDaily:true,post905});
 assert.deepEqual(x.post905,post905);
 assert.equal(x.eligibleForNotifications,false);
 assert.equal(x.eligibleForProduction,false);
});
test('blocked reconciliation and mismatched code never release outcomes',()=>{
 const blocked=summarizeMinutePilotResult({minute,reconciliation:{...reconciliation,blocked:true,blockers:['MISMATCH']},compareDaily:true,post905});
 assert.equal(blocked.post905,null);
 const mismatch=summarizeMinutePilotResult({minute,reconciliation,compareDaily:true,post905:{...post905,code:'1301'}});
 assert.equal(mismatch.post905,null);
});
