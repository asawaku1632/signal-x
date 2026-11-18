import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateFrozen953RegimeComparison,summarizeFrozen953Regimes}
 from '../app/lib/research/ma75Frozen953MarketRegime.mjs';
const codes=Array.from({length:953},(_,i)=>String(1000+i));
const asOfDates=['2026-11-04','2026-11-05','2026-11-06','2026-11-09','2026-11-10','2026-11-11'];
const outcomeDates=['2026-11-12','2026-11-13','2026-11-16','2026-11-17','2026-11-18'];
const SHA='84bed698421ead22ebbce3fac0cb0aab08505332541acd1316957bb4151f3cab';
function fixture({trail=2,held=1,missing=0}={}){
 const projections={};
 for(const [i,date] of [...asOfDates,...outcomeDates].entries()){
  projections[date]={
   date,completeProviderPagination:true,originalAllListedRows:4449,
   audit:{failures:[],rows:codes.map((code,index)=>{
    const price=i<6?100+(trail*i/5):100+trail+held*(i-5)/5;
    const status=index<missing?'NO_TRADE':'DAILY_BAR';
    return {code,tradeDate:date,status,bar:status==='DAILY_BAR'?{
     code,tradeDate:date,open:price,high:price+1,low:price-1,
     close:price,volume:1000}:null};
   })}
  };
 }
 const perFrozenCodeHorizon=[];
 for(const h of [1,3,5])for(let i=0;i<25;i++)
  perFrozenCodeHorizon.push({
   code:codes[i],risingMA75:i<16,budgetEligible:true,horizonSessions:h,
   status:'HYPOTHETICAL_OUTCOME_ONLY',
   netReturnPercent:(i<16?1:-2)*h/5
  });
 const cohort={status:'SHADOW_NOT_APPROVED',signalDate:'2026-11-11',
  ownerLocalLockSha256:SHA,originalBreakouts:25,
  originalRisingBreakouts:16,originalNonRisingBreakouts:9,
  perFrozenCodeHorizon,eligibleForTrading:false,
  eligibleForNotifications:false,eligibleForProduction:false};
 const input={signalDate:'2026-11-11',asOfDates,outcomeDates,
  projectedByDate:projections,frozenCodes:codes,cohort,
  expectedLockSha:SHA,expectedCount:25,expectedRising:16};
 return input;
}
test('classifies a true pre-signal UP proxy and excludes all signal codes from peers',()=>{
 const x=evaluateFrozen953RegimeComparison(fixture());
 assert.equal(x.priorFiveSessionRegime,'UP');
 assert.equal(x.preSignalProxyValidCodes,953);
 assert.equal(x.horizons.session5.peer.all.measured,928);
 assert.equal(x.horizons.session5.all.signals.measured,25);
 assert.equal(x.horizons.session5.rising.signals.measured,16);
 assert.equal(x.horizons.session5.nonRising.signals.measured,9);
 assert.equal(x.horizons.session5.peer.counts.signalCodesExcluded,25);
 assert.equal(x.horizons.session5.peer.counts.invalidOrMissing,0);
 assert.equal(x.eligibleForTrading,false);
 assert.equal(x.networkRequests,0);
 assert.equal(x.filesWritten,0);
});
test('future market collapse never changes pre-signal classification',()=>{
 const up=evaluateFrozen953RegimeComparison(fixture({trail:2,held:1}));
 const collapse=evaluateFrozen953RegimeComparison(fixture({trail:2,held:-30}));
 assert.equal(up.priorFiveSessionRegime,'UP');
 assert.equal(collapse.priorFiveSessionRegime,'UP');
 assert.ok(collapse.horizons.session5.peer.all.mean<up.horizons.session5.peer.all.mean);
});
test('DOWN, SIDEWAYS and UNKNOWN remain distinct; no defaulting missing to DOWN',()=>{
 assert.equal(evaluateFrozen953RegimeComparison(fixture({trail:-3})).priorFiveSessionRegime,'DOWN');
 assert.equal(evaluateFrozen953RegimeComparison(fixture({trail:0.4})).priorFiveSessionRegime,'SIDEWAYS');
 const bad=evaluateFrozen953RegimeComparison(fixture({trail:-5,missing:160}));
 assert.equal(bad.preSignalProxyValidCodes,793);
 assert.equal(bad.priorFiveSessionRegime,'UNKNOWN');
 assert.equal(bad.horizons.session5.peer.all.measured,793);
});
test('strict time, source, frozen original and cohort seals fail closed',()=>{
 const a=fixture();
 delete a.projectedByDate['2026-11-13'];
 assert.throws(()=>evaluateFrozen953RegimeComparison(a),/MISSING_OR_INCOMPLETE_ORIGINAL_DAY/);
 const b=fixture();b.cohort.ownerLocalLockSha256='x'.repeat(64);
 assert.throws(()=>evaluateFrozen953RegimeComparison(b),/FROZEN_IDENTITY_CHANGED/);
 const c=fixture();c.cohort.perFrozenCodeHorizon.pop();
 assert.throws(()=>evaluateFrozen953RegimeComparison(c),/FROZEN_IDENTITY_CHANGED/);
 const d=fixture();d.projectedByDate['2026-11-19']=d.projectedByDate['2026-11-18'];
 assert.throws(()=>evaluateFrozen953RegimeComparison(d),/EXTRA_OR_WRONG_SOURCE_DATE/);
 const e=fixture();e.cohort.perFrozenCodeHorizon[0].risingMA75=false;
 assert.throws(()=>evaluateFrozen953RegimeComparison(e),/COHORT_MEMBERSHIP_DRIFT/);
});
test('regime summary equal-weights signal DATES and refuses duplicate date',()=>{
 const a=evaluateFrozen953RegimeComparison(fixture());
 const b=evaluateFrozen953RegimeComparison(fixture({trail:-3,held:-2}));
 b.signalDate='2026-11-02';
 const s=summarizeFrozen953Regimes([a,b]);
 assert.equal(s.marketRegimes.UP.independentSignalDates,1);
 assert.equal(s.marketRegimes.DOWN.independentSignalDates,1);
 assert.equal(s.marketRegimes.SIDEWAYS.independentSignalDates,0);
 assert.equal(s.marketRegimes.SIDEWAYS.session5MeanAcrossDates,null);
 assert.throws(()=>summarizeFrozen953Regimes([a,a]),/DUPLICATE_DATE_RESULT/);
 assert.equal(s.eligibleForProduction,false);
});
