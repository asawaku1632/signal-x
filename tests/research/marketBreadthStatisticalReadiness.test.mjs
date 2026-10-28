import test from 'node:test';
import assert from 'node:assert/strict';
import {assessMarketBreadthStatisticalReadiness as assess} from '../../lib/research/marketBreadthStatisticalReadiness.mjs';
const row=(id,date,ret)=>({signalRecordId:id,tradeDate:date,fiveSessionReturnPercent:ret,independentlyAudited:true});
test('empty dataset is not ready',()=>{const x=assess();assert.equal(x.counts.valid,0);assert.equal(x.metrics.meanFiveSessionReturnPercent,null);assert.equal(x.statisticallyReadyForIndependentReview,false)});
test('calculates mean median and positive rate',()=>{const x=assess({observations:[row('a','2026-10-01',-2),row('b','2026-10-02',4),row('c','2026-11-02',8)],minSignals:3,minTradeDates:2,minMonths:2});assert.equal(x.metrics.meanFiveSessionReturnPercent,10/3);assert.equal(x.metrics.medianFiveSessionReturnPercent,4);assert.equal(x.metrics.positiveRate,2/3);assert.equal(x.statisticallyReadyForIndependentReview,true);assert.equal(x.aiPromotionAuthorized,false)});
test('unverified outcomes are excluded',()=>{const x=assess({observations:[{...row('a','2026-10-01',5),independentlyAudited:false}]});assert.equal(x.counts.valid,0);assert.equal(x.counts.rejected,1)});
test('duplicate signal IDs are all quarantined',()=>{const x=assess({observations:[row('a','2026-10-01',5),row('a','2026-10-01',7)]});assert.equal(x.counts.valid,0);assert.equal(x.counts.duplicateQuarantined,2)});
test('insufficient months blocks readiness',()=>{const x=assess({observations:[row('a','2026-10-01',5),row('b','2026-10-02',6)],minSignals:2,minTradeDates:2,minMonths:3});assert.equal(x.statisticallyReadyForIndependentReview,false);assert.ok(x.missing.includes('MIN_MONTHS'))});
