import test from 'node:test';
import assert from 'node:assert/strict';
import {compareMarketBreadthPairedBaseline as compare} from '../../lib/research/marketBreadthPairedBaselineComparison.mjs';
const row=(code,date,research,baseline)=>({code,tradeDate:date,signalRecordId:'research:'+code+date,baselineRecordId:'baseline:'+code+date,researchReturnPercent:research,baselineReturnPercent:baseline,horizonSessions:5,researchIndependentlyAudited:true,baselineIndependentlyAudited:true,samePriceBasisVerified:true});
test('paired return differences computed on identical code/date',()=>{const r=compare({pairs:[row('641A','2026-10-28',5,2),row('590A','2026-10-29',-1,1)],minPairs:2,minDates:2});assert.equal(r.metrics.meanPairedDeltaPercentagePoints,0.5);assert.equal(r.metrics.positiveDeltaRate,0.5);assert.equal(r.pairedSampleReady,true);assert.equal(r.aiPromotionAuthorized,false)});
test('duplicate code and date quarantine both',()=>{const a=row('641A','2026-10-28',5,2);const r=compare({pairs:[a,{...a,signalRecordId:'research:other'}]});assert.equal(r.counts.validPairs,0);assert.equal(r.counts.rejected,2)});
test('unverified baseline is excluded',()=>{const r=compare({pairs:[{...row('641A','2026-10-28',5,2),baselineIndependentlyAudited:false}]});assert.equal(r.counts.validPairs,0)});
test('mismatched horizon is excluded',()=>{const r=compare({pairs:[{...row('641A','2026-10-28',5,2),horizonSessions:4}]});assert.equal(r.counts.validPairs,0)});
test('empty baseline does not imply improvement',()=>{const r=compare();assert.equal(r.metrics.meanPairedDeltaPercentagePoints,null);assert.equal(r.pairedSampleReady,false)});
