import test from 'node:test';
import assert from 'node:assert/strict';
import {auditMorningMinuteShadow} from '../app/lib/research/morningMinuteShadow.mjs';
const freeze=()=>({
 schemaVersion:'ma75-forward-universe-candidate-freeze-v1',
 frozenAt:'2026-10-31T13:43:02.737Z',firstEligibleSignalDate:'2026-11-02',
 populationSize:2,codes:['3753','9984'],
 selectionSQL:"SELECT DISTINCT code FROM public.daily_stock_results WHERE date = '2026-10-30'",
 historicalSelectionBias:'Previously app observed subset, not all TSE stocks.',
 sourceChecks:{providerRights:'UNVERIFIED',barCaptureTimestamps:'UNVERIFIED',
 splitAdjustments:'UNVERIFIED',officialTradingCalendar:'UNVERIFIED',liquidityCoverage:'UNVERIFIED'},
 automaticCollectionEnabled:false,liveTradingEligible:false,
 notificationEligible:false,independentlyValidatedForwardReturns:0
});
const tradeDate='2026-10-30';
const bar=(Time,price,overrides={})=>({
 Code:'37530',Date:tradeDate,Time,O:price,H:price+0.5,L:price-0.5,
 C:price,Vo:100,Va:100*price,...overrides
});
const trades=()=>[
 bar('09:00',100),bar('09:01',99),bar('09:02',97),bar('09:04',96),
 bar('09:05',97),bar('09:10',95),bar('09:11',97.5),bar('09:30',98)
];
const page=(rows,req=null,token=null,receivedAt='2026-10-30T08:00:00Z')=>({
 requestPaginationKey:req,receivedAt,response:{
  data:rows,...(token===null?{}:{pagination_key:token})
 }
});
const sample=(pages=[page(trades())],opts={})=>
 auditMorningMinuteShadow(freeze(),{code:opts.code??'3753',
  date:opts.date??tradeDate,pages});
test('explicit pre-freeze study date is historical-only, not a forward signal',()=>{
 const r=sample();
 assert.equal(r.structuralPass,true);
 assert.equal(r.preFreezeHistoricalDate,true);
 assert.equal(r.originalFrozenCohortSize,2);
 assert.equal(r.pilotIsFullFrozenUniverse,false);
 assert.equal(r.acceptedLiveTradeSignals,0);
 assert.equal(r.eligibleForNotifications,false);
 assert.equal(r.eligibleForProduction,false);
});
test('the 09:05 as-of hypothetical view excludes the 09:05 minute and all later lows',()=>{
 const r=sample(),x=r.asOf905;
 assert.equal(x.assumedClockCutoffJst,'09:05');
 assert.equal(x.observedMinuteBars,4);
 assert.equal(x.open,100);
 assert.equal(x.close,96);
 assert.equal(x.low,95.5);
 assert.equal(x.high,100.5);
 assert.equal(x.openToClosePercent,-4);
 assert.equal(x.quoteAvailableAtActual905,false);
 assert.equal(r.actual905AvailabilityVerified,false);
});
test('later highs only: morning bottom 09:10 rebounds 1% and 2% at 09:11',()=>{
 const r=sample(),x=r.retrospective;
 assert.equal(x.bottomMinute,'09:10');
 assert.equal(x.bottomPrice,94.5);
 assert.equal(x.subsequent1PctReachedAt,'09:11');
 assert.equal(x.subsequent2PctReachedAt,'09:11');
 assert.equal(x.maximumLaterHigh,98.5);
 assert.equal(x.hindsightOnly,true);
 assert.equal(x.barHighLowSequenceUnknown,true);
});
test('provider returns unordered data: analysis sorts minute records by actual Time',()=>{
 const rows=trades().reverse();
 const r=sample([page(rows)]);
 assert.equal(r.structuralPass,true);
 assert.equal(r.asOf905.firstTradeAt,'09:00');
 assert.equal(r.retrospective.bottomMinute,'09:10');
});
test('no trades in 09:00-09:02 must not invent a 09:00 opening auction',()=>{
 const r=sample([page([bar('09:03',101),bar('09:04',102),bar('09:11',103)])]);
 assert.equal(r.structuralPass,true);
 assert.equal(r.asOf905.firstTradeAt,'09:03');
 assert.equal(r.asOf905.openingTradeAfter0900,true);
 assert.equal(r.asOf905.observedMinuteBars,2);
 assert.equal(r.asOf905.noTradesInSomeMinutesArePossible,true);
});
test('one 09:05 bar alone cannot be treated as 09:05 available data',()=>{
 const r=sample([page([bar('09:05',100),bar('09:10',99)])]);
 assert.equal(r.structuralPass,true);
 assert.equal(r.asOf905,null);
 assert.equal(r.retrospective.firstTradeAt,'09:05');
 assert.equal(r.eligibleForNotifications,false);
});
test('no trades on a thin stock returns no invented zero-price bars or breakout signal',()=>{
 const r=sample([page([])]);
 assert.equal(r.structuralPass,true);
 assert.equal(r.observedRawBars,0);
 assert.equal(r.asOf905,null);
 assert.equal(r.retrospective,null);
 assert.equal(r.noTradeMinutesMustNotBeFilled,true);
});
test('within-minute low and high cannot be sequenced as a profitable rebound',()=>{
 const r=sample([page([bar('09:00',101),bar('09:20',95,{H:105,L:90})])]);
 assert.equal(r.retrospective.bottomMinute,'09:20');
 assert.equal(r.retrospective.maximumLaterHigh,null);
 assert.equal(r.retrospective.maximumReboundPercent,null);
 assert.equal(r.retrospective.subsequent1PctReachedAt,null);
});
test('pagination must include every page and allow an empty terminal key',()=>{
 const all=trades(),pages=[
  page(all.slice(0,4),null,'NEXT'),
  page(all.slice(4),'NEXT','')
 ];
 const r=sample(pages);
 assert.equal(r.structuralPass,true);
 assert.equal(r.pageChainComplete,true);
 assert.equal(r.observedRawBars,8);
 assert.equal(r.errors.length,0);
});
test('truncated pagination blocks both features and outcomes',()=>{
 const r=sample([page(trades().slice(0,4),null,'NEXT')]);
 assert.equal(r.structuralPass,false);
 assert.ok(r.errors.includes('INCOMPLETE_PAGE_CHAIN'));
 assert.equal(r.asOf905,null);
 assert.equal(r.retrospective,null);
});
test('changed page key and repeated continuation cannot silently omit future lows',()=>{
 const a=sample([page(trades().slice(0,2),null,'NEXT'),page(trades().slice(2),'WRONG')]);
 assert.ok(a.errors.includes('BROKEN_PAGE_CHAIN'));
 const b=sample([page([],null,'NEXT'),page([],'NEXT','NEXT')]);
 assert.ok(b.errors.includes('INVALID_OR_REPEAT_PAGE_TOKEN'));
});
test('same code-time returned on two pages is quarantined instead of averaging price',()=>{
 const r=sample([page([bar('09:00',100)],null,'NEXT'),
  page([bar('09:00',110)],'NEXT')]);
 assert.equal(r.structuralPass,false);
 assert.ok(r.errors.includes('DUPLICATE_MINUTE_BAR'));
});
test('wrong security class, different code or incorrect trade date are rejected',()=>{
 for(const wrong of [
  {Code:'37531'},{Code:'99840'},{Date:'2026-10-29'},
  {Time:'09:60'},{Time:'11:45'},{Time:'15:27'}
 ]){
  const r=sample([page([bar('09:00',100,wrong)])]);
  assert.equal(r.structuralPass,false);
  assert.ok(r.errors.includes('WRONG_CODE_DATE_OR_SESSION_TIME'));
 }
});
test('15:30 closing auction bar allowed, while lunch break and after-close are rejected',()=>{
 const ok=sample([page([bar('09:00',100),bar('11:30',100),bar('12:30',101),bar('15:30',102)])]);
 assert.equal(ok.structuralPass,true);
 const bad=sample([page([bar('15:31',100)])]);
 assert.equal(bad.structuralPass,false);
});
test('malformed price, turnover, trading volume and high/low geometries fail closed',()=>{
 for(const bad of [{O:-1},{Vo:0},{Va:0},{Va:1},{Va:9999999},
  {H:20},{L:200},{C:NaN}]){
  const r=sample([page([bar('09:00',100,bad)])]);
  assert.equal(r.structuralPass,false);
  assert.ok(r.errors.includes('INVALID_RAW_OHLCV_TURNOVER'));
 }
});
test('reversed capture instant, receipt before close, missing request key quarantine',()=>{
 const wrong=sample([page([],null,'NEXT','2026-10-31T08:00:00Z'),
    page([],'NEXT',null,'2026-10-30T08:00:00Z')]);
 assert.ok(wrong.errors.includes('INVALID_OR_REVERSED_PAGE_RECEIPT'));
 const early=sample([page(trades(),null,null,'2026-10-30T05:00:00Z')]);
 assert.equal(early.structuralPass,false);
 const absent=page(trades());delete absent.requestPaginationKey;
 assert.ok(sample([absent]).errors.includes('UNKNOWN_REQUEST_PAGINATION_KEY'));
});
test('unrecognized, absent or non-frozen symbols cannot be used in a pilot',()=>{
 assert.throws(()=>sample(undefined,{code:'1234'}),TypeError);
 assert.throws(()=>sample(undefined,{date:'2026-11-31'}),TypeError);
 assert.throws(()=>auditMorningMinuteShadow(freeze(),{code:'3753',date:tradeDate,pages:[]}),TypeError);
});
