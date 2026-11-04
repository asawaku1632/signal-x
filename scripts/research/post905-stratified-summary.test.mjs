import test from 'node:test';
import assert from 'node:assert/strict';
import {stratify,loadReports} from './post905-stratified-summary.mjs';
const report=(code,date,upside,pre905BarCount=5)=>({
 code,date,status:'HISTORICAL_MINUTE_DAILY_STRUCTURAL_MATCH',
 dailyReconciliationMatched:true,metricsReleasedForHistoricalResearch:true,
 pageChainComplete:true,historicalQualityHold:false,
 post905:{code,date,hindsightOnly:true,eligibleForNotifications:false,
 eligibleForProduction:false,pre905BarCount,post905MorningBarCount:18,
 upsideFromReferencePercent:upside,downsideFromReferencePercent:0}
});
test('date and code groups preserve exclusions and do not invent hit rates',()=>{
 const r=[report('1301','2026-10-29',0.22497,3),
 report('1301','2026-10-30',0.44297),
 report('1332','2026-10-30',0.73394)];
 const x=stratify(r);
 assert.equal(x.overall.accepted,2);
 assert.deepEqual(x.byDate.map(g=>[g.value,g.accepted,g.excluded]),[
 ['2026-10-29',0,1],['2026-10-30',2,0]]);
 assert.equal(x.byDate[0].thresholds[0].reachedRatePercent,null);
 assert.deepEqual(x.byCode.map(g=>[g.value,g.accepted,g.excluded]),[
 ['1301',1,1],['1332',1,0]]);
 assert.equal(x.eligibleForProduction,false);
});
test('duplicate code-day reports rejected across groups',()=>{
 assert.throws(()=>stratify([report('1301','2026-10-30',1),report('1301','2026-10-30',2)]));
});
test('file loading rejects mismatched names and ignores nonreport JSON',()=>{
 const listing=()=>['1301_2026-10-30.json','cohort-summary-v5.json'];
 const reader=()=>JSON.stringify(report('1301','2026-10-30',0.5));
 assert.equal(loadReports('unused',listing,reader).length,1);
 assert.throws(()=>loadReports('unused',listing,()=>JSON.stringify(report('1332','2026-10-30',0.5))));
});
