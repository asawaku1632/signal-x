import test from 'node:test';
import assert from 'node:assert/strict';
import {assessResearchReadiness} from './post905-research-readiness.mjs';
const r=(code,date,pre905BarCount=5)=>({code,date,
 status:'HISTORICAL_MINUTE_DAILY_STRUCTURAL_MATCH',
 dailyReconciliationMatched:true,metricsReleasedForHistoricalResearch:true,
 pageChainComplete:true,historicalQualityHold:false,
 post905:{code,date,hindsightOnly:true,eligibleForNotifications:false,
 eligibleForProduction:false,pre905BarCount,post905MorningBarCount:20,
 upsideFromReferencePercent:0.4,downsideFromReferencePercent:0}});
test('one accepted date remains insufficient despite two symbols',()=>{
 const x=assessResearchReadiness([r('1301','2026-10-29',3),
 r('1301','2026-10-30'),r('1332','2026-10-30')]);
 assert.equal(x.accepted,2);
 assert.equal(x.acceptedDates,1);
 assert.ok(x.gaps.includes('FEWER_THAN_TWO_ACCEPTED_DATES'));
 assert.equal(x.reportsWithoutPre905TimestampEvidence,3);
 assert.equal(x.eligibleForProduction,false);
});
test('more dates cannot imply as-of or out-of-sample validation',()=>{
 const x=assessResearchReadiness([r('1301','2026-10-29'),r('1332','2026-10-30')]);
 assert.equal(x.acceptedDates,2);
 assert.ok(x.gaps.includes('NO_INDEPENDENT_AS_OF_0905_SIGNAL_REPLAY'));
 assert.ok(x.gaps.includes('NO_OUT_OF_SAMPLE_FORWARD_VALIDATION'));
 assert.equal(x.verifiedTradingEdge,false);
});
test('no accepted reports reports no accepted coverage',()=>{
 const x=assessResearchReadiness([r('1301','2026-10-29',3)]);
 assert.ok(x.gaps.includes('NO_ACCEPTED_REPORTS'));
 assert.equal(x.accepted,0);
});
