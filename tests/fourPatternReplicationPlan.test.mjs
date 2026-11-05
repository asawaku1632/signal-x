import test from 'node:test';
import assert from 'node:assert/strict';
import {
 REPLICATION_PLAN,FOUR_PATTERN_REPLICATION_PLAN_VERSION,
 verifyFourPatternReplicationPlan,
} from '../app/lib/research/fourPatternReplicationPlan.mjs';
import {runFourPatternReplicationPlan}
 from '../scripts/research/show-four-pattern-replication-plan.mjs';
import {
 TSE_MARKET_CALENDAR,resolveTseTradingDatesAfter,
} from '../app/lib/technicalObservation/tseMarketCalendar.ts';

const clone=()=>JSON.parse(JSON.stringify(REPLICATION_PLAN));
test('planned November 2026 replication has exactly 20 future consecutive JPX sessions',()=>{
 const result=verifyFourPatternReplicationPlan();
 assert.equal(result.status,'PREDECLARED_HOLDOUT_PLAN_ONLY');
 assert.equal(result.version,FOUR_PATTERN_REPLICATION_PLAN_VERSION);
 assert.equal(result.targetWindow.start,'2026-11-06');
 assert.equal(result.targetWindow.end,'2026-12-04');
 assert.equal(result.targetWindow.tradingDates.length,20);
 assert.deepEqual(result.targetWindow.tradingDates,
  resolveTseTradingDatesAfter('2026-11-05',20,{
   calendar:TSE_MARKET_CALENDAR,maxLookaheadDays:40,
  }));
 assert.equal(result.targetWindow.tradingDates.includes('2026-11-23'),false);
 assert.equal(result.productionReady,false);
 assert.equal(result.notificationEligible,false);
 assert.equal(result.dataAcquired,false);
 assert.equal(result.backtestCompleted,false);
 assert.equal(result.forwardMarketAvailabilityProven,false);
});
test('three original stocks and three preselected different-stock targets are pinned',()=>{
 const r=verifyFourPatternReplicationPlan();
 assert.deepEqual(r.targetWindow.previouslyStudiedCodes,['3762','7203','7752']);
 assert.deepEqual(r.targetWindow.newComparisonCodes,['1301','3402','9005']);
 assert.deepEqual(r.targetWindow.codes,['1301','3402','3762','7203','7752','9005']);
 assert.equal(r.studyDesign.frictionEachSide,0.001);
 assert.equal(r.studyDesign.shares,100);
 assert.equal(r.studyDesign.maxBudgetYen,500000);
 assert.deepEqual(r.studyDesign.holdTradingDays,[1,3,5]);
});
test('later alteration of one date or holiday causes fail-closed rejection',()=>{
 const p=clone();
 p.plannedNextPeriod.tradingDates[11]='2026-11-23';
 assert.equal(verifyFourPatternReplicationPlan({plan:p}).status,
  'BLOCKED_REPLICATION_DATE_SET_NOT_CONTIGUOUS');
});
test('changing symbol set, lookback or transaction costs blocks preregistration',()=>{
 const p=clone();p.plannedNextPeriod.codes[0]='9984';
 assert.equal(verifyFourPatternReplicationPlan({plan:p}).status,
  'BLOCKED_REPLICATION_STOCK_COHORT_CHANGED');
 const q=clone();q.studyDesign.maxBudgetYen=1000000;
 assert.equal(verifyFourPatternReplicationPlan({plan:q}).status,
  'BLOCKED_REPLICATION_FROZEN_RULES_CHANGED');
 const k=clone();k.plannedNextPeriod.start='2026-11-05';
 assert.equal(verifyFourPatternReplicationPlan({plan:k}).status,
  'BLOCKED_REPLICATION_DATE_SPLIT_INVALID');
});
test('missing or changed calendar version blocks rather than trusting business-day guesses',()=>{
 const stale={...TSE_MARKET_CALENDAR,version:'UNKNOWN'};
 assert.equal(verifyFourPatternReplicationPlan({calendar:stale}).status,
  'BLOCKED_REPLICATION_CALENDAR_VERSION_MISMATCH');
 assert.equal(verifyFourPatternReplicationPlan({calendar:null}).status,
  'BLOCKED_REPLICATION_CALENDAR_VERSION_MISMATCH');
});
test('plan viewer is no-network, no-key and rejects runtime argument override',()=>{
 const output=runFourPatternReplicationPlan([]);
 assert.equal(output.status,'PREDECLARED_HOLDOUT_PLAN_ONLY');
 assert.equal(output.forwardMarketAvailabilityProven,false);
 const rejected=runFourPatternReplicationPlan(['--codes=9984']);
 assert.equal(rejected.status,'BLOCKED_NO_RUNTIME_PLAN_OVERRIDES_ALLOWED');
 assert.equal(rejected.productionReady,false);
});
