import test from 'node:test';
import assert from 'node:assert/strict';
import {parseArgs,buildCohortFromFiles,resolveCohortInputs} from './post905-cohort-local.mjs';
const good={code:'1301',date:'2026-10-30',status:'HISTORICAL_MINUTE_DAILY_STRUCTURAL_MATCH',
 dailyReconciliationMatched:true,metricsReleasedForHistoricalResearch:true,
 pageChainComplete:true,historicalQualityHold:false,
 post905:{code:'1301',date:'2026-10-30',hindsightOnly:true,
 eligibleForNotifications:false,eligibleForProduction:false,
 pre905BarCount:5,post905MorningBarCount:18,
 upsideFromReferencePercent:0.44297,downsideFromReferencePercent:0}};
test('local CLI requires explicit input and nonoverlapping output',()=>{
 assert.throws(()=>parseArgs([]));
 assert.throws(()=>parseArgs(['--input=a','--output=a']));
 assert.deepEqual(parseArgs(['--input=a','--output=b']).input,['a']);
});
test('local reports aggregate offline without external access',()=>{
 const x=buildCohortFromFiles(['a'],()=>JSON.stringify(good));
 assert.equal(x.accepted,1);assert.equal(x.thresholds[1].reachedCount,0);
});
test('malformed and oversized reports are rejected',()=>{
 assert.throws(()=>buildCohortFromFiles(['a'],()=>'{'));
 assert.throws(()=>buildCohortFromFiles(['a'],()=> ' '.repeat(100001)));
});

test('directory scan only accepts bounded code-date JSON names',()=>{
 const args=parseArgs(['--input-dir=reports','--output=summary.json']);
 const entries=['1301_2026-10-30.json','1332_2026-10-30.json','junk.json','1301_2026-10-30.json.bak'].map(name=>({name,isFile:()=>true}));
 const files=resolveCohortInputs(args,()=>entries);
 assert.equal(files.length,2);
 assert.ok(files.every(p=>p.endsWith('.json')));
});
test('empty directory is rejected rather than producing misleading empty summary',()=>{
 const args=parseArgs(['--input-dir=reports','--output=summary.json']);
 assert.throws(()=>resolveCohortInputs(args,()=>[]));
});
