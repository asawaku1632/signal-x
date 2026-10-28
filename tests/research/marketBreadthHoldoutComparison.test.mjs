import test from 'node:test';
import assert from 'node:assert/strict';
import {compareMarketBreadthHoldoutPerformance as compare} from '../../lib/research/marketBreadthHoldoutComparison.mjs';
const row=(id,date,ret)=>({signalRecordId:id,tradeDate:date,fiveSessionReturnPercent:ret,independentlyAudited:true});
const split={trainingEndDate:'2026-09-30',holdoutStartDate:'2026-10-10',minHoldoutSignals:1,minHoldoutDates:1};
test('lower holdout mean is descriptive deterioration only',()=>{const r=compare({...split,observations:[row('a','2026-09-20',10),row('b','2026-10-20',-2)]});assert.equal(r.comparison.meanReturnDeltaPercentagePoints,-12);assert.equal(r.descriptiveMeanDeteriorationObserved,true);assert.equal(r.aiPromotionAuthorized,false)});
test('higher holdout mean does not prove improvement',()=>{const r=compare({...split,observations:[row('a','2026-09-20',-2),row('b','2026-10-20',10)]});assert.equal(r.comparison.meanReturnDeltaPercentagePoints,12);assert.equal(r.interpretation,'NO_DESCRIPTIVE_MEAN_DETERIORATION_DETECTED');assert.equal(r.productionEligible,false)});
test('missing holdout produces null deltas',()=>{const r=compare({...split,observations:[row('a','2026-09-20',10)]});assert.equal(r.holdoutComparisonAvailable,false);assert.equal(r.comparison.meanReturnDeltaPercentagePoints,null)});
test('unverified outcomes cannot create comparison',()=>{const r=compare({...split,observations:[row('a','2026-09-20',10),{...row('b','2026-10-20',20),independentlyAudited:false}]});assert.equal(r.holdoutComparisonAvailable,false)});
