import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeBreadthResearchCohorts as summary} from '../../lib/research/marketBreadthCohortSummary.mjs';
const r=(code,marketStatus,return5dPct=2)=>({eligible:true,tradeDate:'2026-10-28',code,signalGeneratedAt:'2026-10-28T09:15:00+09:00',marketStatus,return5dPct});
test('empty cohorts cannot claim comparison readiness',()=>{const s=summary([]);assert.equal(s.comparisonReady,false);assert.equal(s.deltaMean5dPct,null);assert.equal(s.productionEligible,false)});
test('one cohort alone cannot establish comparison',()=>assert.equal(summary([r('3001','INDEX_BREADTH_DIVERGENCE')],{minPerCohort:1,minDates:1}).comparisonReady,false));
test('verified two cohorts yield descriptive comparison',()=>{const s=summary([r('3001','INDEX_BREADTH_DIVERGENCE',3),r('3002','OBSERVED',1)],{minPerCohort:1,minDates:1});assert.equal(s.comparisonReady,false);assert.equal(s.deltaMean5dPct,null);assert.equal(s.productionEligible,false)});
test('unverified evidence excluded',()=>assert.equal(summary([{...r('3001','OBSERVED'),eligible:false}]).rejectionCounts.EVIDENCE_NOT_VERIFIED,1));
test('unknown cohort excluded',()=>assert.equal(summary([r('3001','OTHER')]).rejectionCounts.UNKNOWN_MARKET_COHORT,1));
test('invalid return excluded',()=>assert.equal(summary([r('3001','OBSERVED',NaN)]).rejectionCounts.INVALID_RETURN,1));
test('repeated pair excluded entirely',()=>{const x=r('3001','OBSERVED');const s=summary([x,x,x]);assert.equal(s.other.n,0);assert.equal(s.rejectionCounts.DUPLICATE,3)});
test('unique date requirement blocks misleading small samples',()=>{const s=summary([r('3001','INDEX_BREADTH_DIVERGENCE'),r('3002','OBSERVED')],{minPerCohort:1,minDates:2});assert.equal(s.comparisonReady,false)});

test('zero thresholds cannot make empty groups ready',()=>assert.equal(summary([],{minPerCohort:0,minDates:0}).comparisonReady,false));
test('negative thresholds cannot weaken evidence floor',()=>assert.equal(summary([r('3001','INDEX_BREADTH_DIVERGENCE'),r('3002','OBSERVED')],{minPerCohort:-100,minDates:-10}).comparisonReady,false));
test('invalid threshold types fail to safe defaults',()=>assert.equal(summary([r('3001','INDEX_BREADTH_DIVERGENCE'),r('3002','OBSERVED')],{minPerCohort:NaN,minDates:'0'}).comparisonReady,false));
