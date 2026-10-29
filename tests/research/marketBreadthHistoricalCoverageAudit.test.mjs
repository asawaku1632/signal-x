import test from 'node:test';
import assert from 'node:assert/strict';
import {auditMarketBreadthHistoricalCoverage as audit} from '../../lib/research/marketBreadthHistoricalCoverageAudit.mjs';
test('many signals on one date count as one observation date',()=>{const x=audit({buckets:[{source:'BB',tradeDate:'2026-08-10',eventCount:419,verifiedOutcomeCount:0}]});assert.equal(x.counts.events,419);assert.equal(x.counts.distinctEventDates,1);assert.equal(x.descriptiveOnly,true);assert.equal(x.aiPromotionAuthorized,false)});
test('different sources same date do not inflate distinct days',()=>{const x=audit({buckets:[{source:'BB',tradeDate:'2026-08-10',eventCount:419,verifiedOutcomeCount:0},{source:'TECHNICAL',tradeDate:'2026-08-10',eventCount:313,verifiedOutcomeCount:0}]});assert.equal(x.counts.distinctEventDates,1);assert.equal(x.counts.events,732)});
test('verified outcome coverage is descriptive',()=>{const x=audit({buckets:[{source:'BB',tradeDate:'2026-08-10',eventCount:10,verifiedOutcomeCount:2}]});assert.equal(x.outcomeCoverageRatio,0.2);assert.equal(x.independentImprovementVerified,false)});
test('invalid counts rejected',()=>{const x=audit({buckets:[{source:'BB',tradeDate:'2026-08-10',eventCount:1,verifiedOutcomeCount:2}]});assert.equal(x.counts.acceptedBuckets,0)});
test('duplicate source and date rejected',()=>{const row={source:'BB',tradeDate:'2026-08-10',eventCount:10,verifiedOutcomeCount:0};const x=audit({buckets:[row,row]});assert.equal(x.counts.rejectedBuckets,1)});
