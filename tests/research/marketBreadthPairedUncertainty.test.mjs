import test from 'node:test';
import assert from 'node:assert/strict';
import {assessMarketBreadthPairedUncertainty as assess} from '../../lib/research/marketBreadthPairedUncertainty.mjs';
const row=(code,date,research,baseline)=>({code,tradeDate:date,signalRecordId:'research:'+code+date,baselineRecordId:'baseline:'+code+date,researchReturnPercent:research,baselineReturnPercent:baseline,horizonSessions:5,researchIndependentlyAudited:true,baselineIndependentlyAudited:true,samePriceBasisVerified:true});
test('empty sample has no interval',()=>{const x=assess();assert.equal(x.approximate95PercentInterval,null);assert.equal(x.statisticallyValidatedImprovement,false)});
test('single pair has no variance estimate',()=>{const x=assess({pairs:[row('641A','2026-10-28',5,2)],minPairs:1,minDates:1});assert.equal(x.sampleVariance,null);assert.equal(x.approximate95PercentInterval,null)});
test('paired differences produce descriptive interval only',()=>{const x=assess({pairs:[row('641A','2026-10-28',4,1),row('590A','2026-10-29',7,2)],minPairs:2,minDates:2});assert.equal(x.meanPairedDeltaPercentagePoints,4);assert.equal(x.sampleVariance,2);assert.ok(x.approximate95PercentInterval.lower>0);assert.equal(x.statisticallyValidatedImprovement,false)});
test('duplicate pair does not inflate interval',()=>{const a=row('641A','2026-10-28',5,2);const x=assess({pairs:[a,a]});assert.equal(x.pairedCount,0);assert.equal(x.approximate95PercentInterval,null)});
test('unverified outcomes are excluded',()=>{const x=assess({pairs:[{...row('641A','2026-10-28',5,2),researchIndependentlyAudited:false}]});assert.equal(x.pairedCount,0)});
