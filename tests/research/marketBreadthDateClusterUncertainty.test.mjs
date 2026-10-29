import test from 'node:test';
import assert from 'node:assert/strict';
import {assessMarketBreadthDateClusterUncertainty as assess} from '../../lib/research/marketBreadthDateClusterUncertainty.mjs';
const row=(code,date,research,baseline)=>({code,tradeDate:date,signalRecordId:'research:'+code+date,baselineRecordId:'baseline:'+code+date,researchReturnPercent:research,baselineReturnPercent:baseline,horizonSessions:5,researchIndependentlyAudited:true,baselineIndependentlyAudited:true,samePriceBasisVerified:true});
test('same-date trades form one cluster',()=>{const x=assess({pairs:[row('641A','2026-10-28',5,1),row('590A','2026-10-28',7,1)]});assert.equal(x.pairedCount,2);assert.equal(x.clusterCount,1);assert.equal(x.dateClusterStandardError,null)});
test('daily mean differences are equally weighted by date',()=>{const x=assess({pairs:[row('641A','2026-10-28',2,0),row('590A','2026-10-28',4,0),row('7203','2026-10-29',9,0)],minDates:2});assert.equal(x.meanOfDailyPairedDeltas,6);assert.equal(x.clusterCount,2);assert.equal(x.sampleReady,true);assert.equal(x.independentImprovementVerified,false)});
test('duplicate pairs are quarantined',()=>{const a=row('641A','2026-10-28',5,1);const x=assess({pairs:[a,a]});assert.equal(x.clusterCount,0);assert.equal(x.pairedCount,0)});
test('unverified pair does not contribute',()=>{const x=assess({pairs:[{...row('641A','2026-10-28',5,1),samePriceBasisVerified:false}]});assert.equal(x.clusterCount,0)});
test('empty sample has no interval',()=>{const x=assess();assert.equal(x.approximate95PercentInterval,null);assert.equal(x.sampleReady,false)});
