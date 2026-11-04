import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeMinutePilotResult,parseMinuteProbeArgs,saveMinutePilotReport} from './jquants-minute-pilot.mjs';
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

test('report output is explicitly opted in and UTF-8 exclusive create',()=>{
 const args=parseMinuteProbeArgs(['--code=1332','--date=2026-10-30','--output=reports/1332_2026-10-30.json']);
 assert.equal(args.output,'reports/1332_2026-10-30.json');
 const report=summarizeMinutePilotResult({minute,reconciliation,compareDaily:true,post905});
 let captured;
 assert.equal(saveMinutePilotReport(args.output,report,(...parts)=>{captured=parts;}),true);
 assert.equal(captured[0],args.output);
 assert.equal(captured[2].encoding,'utf8');
 assert.equal(captured[2].flag,'wx');
 assert.equal(JSON.parse(captured[1]).dailyReconciliationMatched,true);
});
test('unreconciled output is rejected and duplicate output flags fail closed',()=>{
 assert.throws(()=>saveMinutePilotReport('bad.json',summarizeMinutePilotResult({minute}),()=>{}));
 assert.throws(()=>parseMinuteProbeArgs(['--output=a.json','--output=b.json']));
 assert.throws(()=>parseMinuteProbeArgs(['--output=../bad.json']));
});
