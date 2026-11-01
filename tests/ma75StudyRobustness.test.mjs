import test from 'node:test';
import assert from 'node:assert/strict';
import { auditMa75StudyRobustness } from '../app/lib/research/ma75StudyRobustness.mjs';

const t = date => Date.parse(date + 'T06:00:00Z') / 1000;
test('excludes pending and quarantined outcomes, retains unknown regimes', () => {
 const study={observations:[
  {kind:'BREAKOUT',code:'1001',signalTime:t('2026-10-01'),outcome5Status:'COMPLETED',return5Percent:2},
  {kind:'BREAKOUT',code:'1002',signalTime:t('2026-10-01'),outcome5Status:'PENDING'},
  {kind:'BREAKOUT',code:'1003',signalTime:t('2026-10-02'),outcome5Status:'QUARANTINED_GAP'},
  {kind:'RETEST',code:'1004',signalTime:t('2026-10-02'),outcome5Status:'COMPLETED',return5Percent:10},
 ]};
 const result=auditMa75StudyRobustness(study,{regimeByDate:{'2026-10-01':{regime:'DOWN',availableAt:t('2026-10-01')-60}}});
 assert.equal(result.overall.count,1);
 assert.equal(result.regimes.DOWN.count,1);
 assert.equal(result.excluded.pending,1);
 assert.equal(result.excluded.quarantined,1);
 assert.equal(result.eligibleForProduction,false);
});
test('invalid input fails closed',()=>{
 assert.throws(()=>auditMa75StudyRobustness({observations:[]},{kind:'OTHER'}));
});

test('future regime evidence is never used for historical signal', () => {
 const time=t('2026-10-01');
 const study={observations:[{kind:'BREAKOUT',code:'1001',signalTime:time,outcome5Status:'COMPLETED',return5Percent:1}]};
 const result=auditMa75StudyRobustness(study,{regimeByDate:{'2026-10-01':{regime:'UP',availableAt:time+60}}});
 assert.equal(result.regimes.UNKNOWN.count,1);
 assert.equal(result.regimes.UP.count,0);
});
test('untimestamped regime strings are unknown by default', () => {
 const study={observations:[{kind:'BREAKOUT',code:'1001',signalTime:t('2026-10-01'),outcome5Status:'COMPLETED',return5Percent:1}]};
 const result=auditMa75StudyRobustness(study,{regimeByDate:{'2026-10-01':'DOWN'}});
 assert.equal(result.regimes.UNKNOWN.count,1);
});
