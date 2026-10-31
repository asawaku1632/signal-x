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

test('three pre-09:05 bars remain excluded with explicit unknown gap cause',()=>{
 const sparse=report('1301',0.22497,-0.22497);
 sparse.date='2026-10-29';sparse.post905.date='2026-10-29';
 sparse.post905.pre905BarCount=3;
 const s=summarizePost905Cohort([sparse,report('1332',0.73394,0.04587)]);
 assert.equal(s.submitted,2);assert.equal(s.accepted,1);
 assert.deepEqual(s.excluded,[{code:'1301',date:'2026-10-29',
  reason:'INCOMPLETE_PRE905_MINUTE_COVERAGE',observedPre905Bars:3,
  expectedClockMinutes:5,missingMinuteCause:'UNKNOWN_NO_TRADE_OR_DATA_GAP'}]);
 assert.equal(s.thresholds[0].denominator,1);
 assert.equal(s.eligibleForProduction,false);
});
test('zero early bars and bad reconciliation are not misclassified as no-trade',()=>{
 const noReference=report('1301',1,0);noReference.post905.pre905BarCount=0;
 const blocked=report('1332',1,0);blocked.dailyReconciliationMatched=false;
 const s=summarizePost905Cohort([noReference,blocked]);
 assert.deepEqual(s.excluded.map(x=>x.reason),['UNVERIFIED_OR_INCOMPLETE','UNVERIFIED_OR_INCOMPLETE']);
 assert.equal(s.accepted,0);assert.equal(s.thresholds[0].reachedRatePercent,null);
});
