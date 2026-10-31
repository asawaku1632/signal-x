import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizePost905Cohort} from '../../app/lib/research/post905CohortShadow.mjs';
const report=(code,upside,downside)=>({
 code,date:'2026-10-30',status:'HISTORICAL_MINUTE_DAILY_STRUCTURAL_MATCH',
 dailyReconciliationMatched:true,metricsReleasedForHistoricalResearch:true,
 pageChainComplete:true,historicalQualityHold:false,
 post905:{code,date:'2026-10-30',hindsightOnly:true,
 eligibleForNotifications:false,eligibleForProduction:false,
 pre905BarCount:5,post905MorningBarCount:18,
 upsideFromReferencePercent:upside,downsideFromReferencePercent:downside}
});
test('two actual historical examples have zero 1% threshold hits',()=>{
 const s=summarizePost905Cohort([report('1301',0.44297,0),report('1332',0.73394,0.04587)]);
 assert.equal(s.accepted,2);
 assert.deepEqual(s.thresholds.map(t=>t.reachedCount),[1,0,0]);
 assert.equal(s.thresholds[0].reachedRatePercent,50);
 assert.equal(s.eligibleForProduction,false);
});
test('blocked reconciliation excluded, not counted as failure',()=>{
 const bad=report('1301',3,-1);bad.dailyReconciliationMatched=false;
 const s=summarizePost905Cohort([bad,report('1332',0.73394,0.04587)]);
 assert.equal(s.accepted,1);assert.equal(s.excluded.length,1);
 assert.equal(s.thresholds[0].denominator,1);
});
test('duplicates rejected and empty cohort never produces fake zero win rate',()=>{
 assert.throws(()=>summarizePost905Cohort([report('1301',1,0),report('1301',2,0)]));
 const s=summarizePost905Cohort([]);
 assert.equal(s.thresholds[0].reachedRatePercent,null);
 assert.equal(s.meanMaximumUpsidePercent,null);
});
