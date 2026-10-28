import test from 'node:test';
import assert from 'node:assert/strict';
import {runMarketBreadthResearchReview as review} from '../../lib/research/marketBreadthReviewPipeline.mjs';
const base={tradeDate:'2026-10-28',code:'641A',marketObservedAt:'2026-10-28T09:00:00+09:00',signalGeneratedAt:'2026-10-28T09:15:00+09:00',evaluatedAt:'2026-11-05T15:30:00+09:00',outcomeDate:'2026-11-05',horizonTradingDays:5,marketStatus:'INDEX_BREADTH_DIVERGENCE',return5dPct:2};
const evidence={signalRecordId:'signal:20261028:641A',marketRecordId:'market:20261028:001',outcomeRecordId:'outcome:20261105:641A',tradeDate:'2026-10-28',code:'641A',marketObservedAt:'2026-10-28T09:00:00+09:00',evaluatedAt:'2026-11-05T15:30:00+09:00',signalProvenanceVerified:true,signalGeneratedAt:base.signalGeneratedAt,marketStatusVerified:true,marketStatus:'INDEX_BREADTH_DIVERGENCE',marketLicenseVerified:true,outcomeLicenseVerified:true,marketProvider:'licensed-market',outcomeProvider:'licensed-outcome',fiveTseSessionsVerified:true,outcomePriceVerified:true,verifiedReturn5dPct:2,outcomeDate:base.outcomeDate};
test('empty data reports insufficient evidence',()=>{const r=review([],()=>evidence);assert.equal(r.report.status,'INSUFFICIENT_VERIFIED_EVIDENCE');assert.equal(r.productionEligible,false)});
test('verified input enters cohort but cannot promote',()=>{const r=review([base],()=>evidence);assert.equal(r.audit.acceptedCount,1);assert.equal(r.cohorts.divergence.n,1);assert.equal(r.report.productionEligible,false)});
test('unverified source is excluded from cohorts',()=>{const r=review([base],()=>({...evidence,marketLicenseVerified:false}));assert.equal(r.cohorts.divergence.n,0);assert.equal(r.report.rejectionCounts.PROVIDER_RIGHTS_UNVERIFIED,1)});
test('duplicate rows remain quarantined',()=>{const r=review([base,base],()=>evidence);assert.equal(r.audit.acceptedCount,0);assert.equal(r.cohorts.divergence.n,0)});
test('unverified market status is rejected before cohort aggregation',()=>{const r=review([{...base,marketStatus:'OTHER'}],()=>evidence);assert.equal(r.cohorts.divergence.n,0);assert.equal(r.audit.rejectionCounts.MARKET_COHORT_UNVERIFIED,1)});
test('missing resolver fails closed',()=>assert.throws(()=>review([base]),/EVIDENCE_RESOLVER_REQUIRED/));

test('a market cohort differing from independent evidence cannot enter summary',()=>{const r=review([{...base,marketStatus:'OBSERVED'}],()=>evidence);assert.equal(r.audit.acceptedCount,0);assert.equal(r.cohorts.other.n,0);assert.equal(r.audit.rejectionCounts.MARKET_COHORT_UNVERIFIED,1)});
