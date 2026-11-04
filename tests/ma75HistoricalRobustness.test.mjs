import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {analyzeMa75RetrospectiveRobustness}
 from '../scripts/research/ma75-historical-robustness.mjs';

const event=(code,date,index,ret,status='COMPLETED')=>({
 kind:'BREAKOUT',code,signalIndex:index,
 signalTime:Math.floor(Date.parse(date+'T00:00:00Z')/1000),
 outcome5Status:status,return5Percent:ret
});

test('greedy first-signal nonoverlap cannot peek at a later winner or a missing outcome',()=>{
 const rows=[
  event('1301','2026-09-01',75,null,'PENDING'),
  event('1301','2026-09-03',77,20),
  event('1301','2026-09-10',82,-5),
  event('1301','2026-09-15',89,2),
  event('1302','2026-09-03',76,1)
 ];
 const got=analyzeMa75RetrospectiveRobustness(rows.slice().reverse());
 assert.equal(got.allSignals.signals,5);
 assert.equal(got.allSignals.completed,4);
 assert.equal(got.allSignals.pending,1);
 const nonoverlap=got.earliestNonOverlappingPerCode;
 assert.equal(nonoverlap.signals,4);
 assert.equal(nonoverlap.completed,3);
 assert.equal(nonoverlap.pending,1);
 assert.equal(nonoverlap.completedTradeWeightedAverage5Percent,-0.6667);
 assert.equal(got.excludesFollowingFiveSessionSignalsWithoutLookingAtFutureOutcome,true);
 assert.equal(got.futureKnowledgeUsedForTradeSelection,false);
 assert.equal(got.independentForwardValidation,false);
 assert.equal(got.eligibleForProduction,false);
 assert.equal(got.eligibleForNotifications,false);
 assert.equal(got.eligibleForTrading,false);
});

test('date-equal weighting is distinguished from clustered event-weighted mean',()=>{
 const rows=[
  event('1301','2026-09-02',75,5),
  event('1302','2026-09-02',76,5),
  event('1303','2026-09-03',77,-9)
 ];
 const out=analyzeMa75RetrospectiveRobustness(rows);
 assert.equal(out.allSignals.completedTradeWeightedAverage5Percent,0.3333);
 assert.equal(out.allSignals.completedSignalDateEqualWeightedAverage5Percent,-2);
 assert.equal(out.allSignals.distinctSignalDates,2);
 assert.equal(out.allSignals.completedSignalDates,2);
 assert.equal(out.allSignals.worstCompletedSignalDateMeanPercent,-9);
});

test('extra symmetric roundtrip friction flips near-zero edge without changing signal selection',()=>{
 const events=[
  event('1301','2026-09-02',75,0.0277),
  event('1302','2026-09-03',77,0.0277)
 ];
 const out=analyzeMa75RetrospectiveRobustness(events);
 assert.equal(out.originalAssumedPerSideFrictionPercent,0.1);
 const scenarios=out.incrementalExecutionFrictionSensitivity;
 assert.deepEqual(scenarios.map(s=>s.additionalRoundTripPercent),[0,0.1,0.2,0.4]);
 assert.equal(scenarios[0].allBreakouts.meanNetReturn5Percent,0.0277);
 assert.equal(scenarios[0].earliestNonOverlappingPerCode.meanNetReturn5Percent,0.0277);
 assert.equal(scenarios[0].allBreakouts.winRatePercent,100);
 assert.ok(scenarios[1].allBreakouts.meanNetReturn5Percent<0);
 assert.equal(scenarios[1].allBreakouts.winRatePercent,0);
 assert.equal(scenarios[1].earliestNonOverlappingPerCode.completed,2);
 assert.ok(scenarios[2].allBreakouts.meanNetReturn5Percent<
  scenarios[1].allBreakouts.meanNetReturn5Percent);
 assert.equal(out.additionalFrictionScenariosAreCounterfactualNotObservedFees,true);
});
test('friction stress excludes pending and quarantined and retains null when none settled',()=>{
 const out=analyzeMa75RetrospectiveRobustness([
  event('1301','2026-10-30',105,null,'PENDING'),
  event('1302','2026-09-29',96,null,'QUARANTINED_GAP')
 ]);
 for(const scenario of out.incrementalExecutionFrictionSensitivity){
  assert.equal(scenario.allBreakouts.completed,0);
  assert.equal(scenario.allBreakouts.meanNetReturn5Percent,null);
  assert.equal(scenario.allBreakouts.dateEqualWeightedMeanNetReturn5Percent,null);
  assert.equal(scenario.allBreakouts.winRatePercent,null);
 }
});
test('pending-only cohort reports null returns rather than a fake winner',()=>{
 const out=analyzeMa75RetrospectiveRobustness([
  event('1301','2026-10-30',105,null,'PENDING')
 ]);
 assert.equal(out.allSignals.completed,0);
 assert.equal(out.allSignals.completedWinRatePercent,null);
 assert.equal(out.allSignals.completedSignalDateEqualWeightedAverage5Percent,null);
});

test('malformed chronology and outcome metadata never enter robustness metrics',()=>{
 for(const bad of [
  {...event('1301','2026-09-02',74,1)},
  {...event('1301','2026-09-02',75,1),signalTime:NaN},
  {...event('1301','2026-09-02',75,1),return5Percent:null},
  {...event('1301','2026-09-02',75,null,'PENDING'),return5Percent:1},
  {...event('1301','2026-09-02',75,1),kind:'RETEST'}
 ])assert.throws(()=>analyzeMa75RetrospectiveRobustness([bad]),
  /MA75_ROBUSTNESS_EVENT_INVALID/);
});

test('read-only stability checks cannot fetch, write research cache or promote a signal',()=>{
 const source=readFileSync(new URL(
  '../scripts/research/ma75-historical-robustness.mjs',import.meta.url),'utf8');
 const executable=source.split('\n').filter(line=>!line.trim().startsWith('*')&&!line.trim().startsWith('//')).join('\n');
 assert.doesNotMatch(executable,/\bfetch\s*\(|writeFileSync|readFileSync|process\.env|JQUANTS_API_KEY|tradeOrder|notificationSend/);
 assert.match(executable,/eligibleForProduction:false/);
 assert.match(executable,/independentForwardValidation:false/);
});
