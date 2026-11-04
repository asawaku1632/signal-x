import test from 'node:test';import assert from 'node:assert/strict';
import {joinMa75Post905} from './ma75-minute-join.mjs';
const point={date:'2026-10-29',close:3385,prior75Sma:2481,distancePercent:36};
const report={code:'3762',date:'2026-10-29',status:'HISTORICAL_MINUTE_DAILY_STRUCTURAL_MATCH',
 dailyReconciliationMatched:true,metricsReleasedForHistoricalResearch:true,
 eligibleForProduction:false,eligibleForNotifications:false,
 post905:{code:'3762',date:'2026-10-29',eligibleForProduction:false,eligibleForNotifications:false,
 asOf905ReferenceClose:3500,upsideFromReferencePercent:2,downsideFromReferencePercent:-4,
 post905HighestHigh:3570,post905LowestLow:3360}};
test('joins validated historical metrics without inventing low time',()=>{
 const x=joinMa75Post905([point],[report])[0];
 assert.equal(x.minuteStatus,'HISTORICAL_METRICS_ONLY');
 assert.equal(x.post905.downsidePercent,-4);
 assert.equal(x.minuteLowTimeAvailable,false);
});
test('missing 09:05 metrics are explicitly unavailable',()=>{
 const x=joinMa75Post905([point],[{...report,post905:{...report.post905,asOf905ReferenceClose:null}}])[0];
 assert.equal(x.minuteStatus,'MISSING_905_METRIC');assert.equal(x.post905,null);
});
test('rejects unverified structural report',()=>{
 const x=joinMa75Post905([point],[{...report,dailyReconciliationMatched:false}])[0];
 assert.equal(x.minuteStatus,'INVALID_RECONCILIATION');
});
test('rejects duplicate dates',()=>assert.throws(()=>joinMa75Post905([point],[report,report])));
