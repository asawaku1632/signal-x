import test from 'node:test';
import assert from 'node:assert/strict';
import {studyMa75BreakoutRetest,MA75_RULES,MA75_STUDY_VERSION,pairedSummary} from '../app/lib/research/ma75BreakoutRetest.mjs';
const bar=(i,close=100,opts={})=>({
  time:1780000000+i*86400,open:opts.open??close,
  close,high:opts.high??Math.max(opts.open??close,close)+1,
  low:opts.low??Math.min(opts.open??close,close)-1,volume:opts.volume??1000,
});
const base=(length=85)=>{
  const c=Array.from({length},(_,i)=>bar(i));
  c[75]=bar(75,105,{open:100,high:106,low:99,volume:2000});
  c[76]=bar(76,104,{open:101,high:105,low:99,volume:1300});
  for(let i=77;i<length;i++)c[i]=bar(i,106+(i-77)*0.25);
  return c;
};
const run=(bars,code='3762')=>studyMa75BreakoutRetest([{code,timeframe:'1D',candles:bars}]);
const records=r=>r.observations;
test('detect first SMA75 close crossover and first next-day support retest',()=>{
  const r=run(base());
  assert.equal(r.version,MA75_STUDY_VERSION);
  assert.equal(r.acceptedCohorts,1);
  const b=records(r).filter(x=>x.kind==='BREAKOUT');
  const p=records(r).filter(x=>x.kind==='RETEST');
  assert.equal(b.length,1);assert.equal(p.length,1);
  assert.equal(b[0].signalIndex,75);assert.equal(p[0].signalIndex,76);
  assert.equal(p[0].breakoutIndex,75);
  assert.ok(b[0].ma75>100 && b[0].ma75Rising);
  assert.equal(b[0].volumeRatio,2);
  assert.equal(b[0].entryTime,base()[76].time);
});
test('only completed horizons enter win rate; no fictitious zero win rate',()=>{
  const r=run(base(78));
  const breakout=r.stats.find(x=>x.kind==='BREAKOUT');
  assert.equal(breakout.pending,1);
  assert.equal(breakout.completed,0);
  assert.equal(breakout.winRatePercent,null);
  assert.equal(r.stats.find(x=>x.kind==='RETEST').pending,1);
});
test('future changes cannot alter signal timing, SMA, slope or volume classification',()=>{
  const a=base(),b=base();
  b[80]=bar(80,85,{open:85,high:86,low:84});
  const x=run(a).observations.find(o=>o.kind==='BREAKOUT');
  const y=run(b).observations.find(o=>o.kind==='BREAKOUT');
  assert.deepEqual([x.signalIndex,x.ma75,x.ma75Rising,x.volumeRatio],
    [y.signalIndex,y.ma75,y.ma75Rising,y.volumeRatio]);
  assert.notEqual(x.return5Percent,y.return5Percent);
});
test('close below support invalidates candidate retest despite later recovery',()=>{
  const c=base();
  c[76]=bar(76,95,{open:100,high:101,low:94});
  c[77]=bar(77,104,{open:99,high:105,low:97});
  assert.equal(run(c).observations.filter(x=>x.kind==='RETEST').length,0);
});
test('reject unsorted bars, invalid OHLC, missing history and suspicious split',()=>{
  const short=run(base().slice(0,70));
  assert.equal(short.excluded[0].reason,'INSUFFICIENT_BARS');
  const dup=base();dup[77]={...dup[77],time:dup[76].time};
  assert.equal(run(dup).excluded[0].reason,'DUPLICATE_OR_UNSORTED');
  const invalid=base();invalid[80]={...invalid[80],low:200};
  assert.equal(run(invalid).excluded[0].reason,'INVALID_OHLCV');
  const split=base();split[60]=bar(60,200);
  assert.equal(run(split).acceptedCohorts,1);
  assert.equal(run(split).observations.filter(x=>x.kind==='BREAKOUT').length,0);
  assert.equal(studyMa75BreakoutRetest([{code:'3762',timeframe:'5m',candles:base()}]).excluded[0].reason,'NOT_DAILY');
});
test('duplicate cohort does not inflate counts, budget eligibility is a subgroup',()=>{
  const c={code:'3762',timeframe:'1D',candles:base()};
  const r=studyMa75BreakoutRetest([c,c]);
  assert.equal(r.acceptedCohorts,1);
  assert.equal(r.excluded[0].reason,'DUPLICATE_COHORT');
  assert.equal(r.stats.find(x=>x.kind==='BREAKOUT').budgetCompleted,0);
  assert.equal(MA75_RULES.shareLot,100);
});
test('future gap cannot erase older signals; outcome-window gap is quarantined',()=>{
  const future=base();future[84]=bar(84,200,{open:200,high:201,low:199});
  const report=run(future);
  assert.equal(report.observations.filter(x=>x.kind==='BREAKOUT').length,1);
  assert.equal(report.stats.find(x=>x.kind==='BREAKOUT').completed,1);
  const within=base();within[80]=bar(80,200,{open:200,high:201,low:199});
  const out=run(within);
  const b=out.observations.find(x=>x.kind==='BREAKOUT');
  assert.equal(b.outcome5Status,'QUARANTINED_GAP');
  assert.equal(b.return5Percent,null);
  assert.equal(out.stats.find(x=>x.kind==='BREAKOUT').pending,0);
  assert.equal(out.stats.find(x=>x.kind==='BREAKOUT').quarantined,1);
});
test('paired comparison uses only same originating breakout with both outcomes complete',()=>{
  const r=run(base());
  assert.equal(r.paired.pairedEvents,1);
  assert.equal(r.paired.pairedCodes,1);
  const breakout=r.observations.find(o=>o.kind==='BREAKOUT');
  const retest=r.observations.find(o=>o.kind==='RETEST');
  assert.equal(r.paired.breakoutAverage5Percent,breakout.return5Percent);
  assert.equal(r.paired.retestAverage5Percent,retest.return5Percent);
  assert.equal(r.paired.bothBudgetEligible,0);
  assert.equal(run(base(78)).paired.pairedEvents,0);
  assert.equal(run(base(78)).paired.retestOutperformedPercent,null);
});

test('paired SMA75 study excludes orphan retests and missing or nonfinite outcomes',()=>{
  const valid={kind:'RETEST',code:'3762',signalIndex:81,breakoutIndex:75,return5Percent:2};
  assert.equal(pairedSummary([valid]).pairedEvents,0);
  for (const missing of [undefined,null,NaN,Infinity]) {
    const b={kind:'BREAKOUT',code:'3762',signalIndex:75,return5Percent:missing};
    assert.equal(pairedSummary([b,valid]).pairedEvents,0);
  }
  const complete={kind:'BREAKOUT',code:'3762',signalIndex:75,return5Percent:1,budgetEligible:true};
  assert.equal(pairedSummary([complete,{...valid,return5Percent:null}]).pairedEvents,0);
  assert.equal(pairedSummary([complete,valid]).pairedEvents,1);
});
