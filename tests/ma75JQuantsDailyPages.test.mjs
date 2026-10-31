import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMa75JQuantsDailyPages} from '../app/lib/research/ma75JQuantsDailyPages.mjs';
const date='2026-11-04';
const freeze=()=>({
 schemaVersion:'ma75-forward-universe-candidate-freeze-v1',
 frozenAt:'2026-10-31T13:43:02.737Z',firstEligibleSignalDate:'2026-11-02',
 populationSize:4,codes:['1301','186A','3753','9984'],
 selectionSQL:"SELECT DISTINCT code FROM public.daily_stock_results WHERE date = '2026-10-30'",
 historicalSelectionBias:'App-observed symbols; does not represent the entire TSE market.',
 sourceChecks:{providerRights:'UNVERIFIED',barCaptureTimestamps:'UNVERIFIED',
  splitAdjustments:'UNVERIFIED',officialTradingCalendar:'UNVERIFIED',
  liquidityCoverage:'UNVERIFIED'},
 automaticCollectionEnabled:false,liveTradingEligible:false,
 notificationEligible:false,independentlyValidatedForwardReturns:0,
});
const bar=(Code='13010',overrides={})=>({
 Date:date,Code,O:100,H:103,L:99,C:102,Vo:20000,
 AdjO:50,AdjC:51,AdjVo:40000,AdjFactor:0.5,...overrides,
});
const noTrade=(Code='186A0')=>bar(Code,{O:null,H:null,L:null,C:null,Vo:null});
const make=(a=[bar()],b=[bar('37530')])=>[
 {requestPaginationKey:null,receivedAt:'2026-11-18T08:00:00Z',
  response:{data:a,pagination_key:'NEXT'}},
 {requestPaginationKey:'NEXT',receivedAt:'2026-11-18T08:02:00Z',
  response:{data:b}},
];
const parse=(pages=make(),f=freeze(),d=date)=>parseMa75JQuantsDailyPages(f,{date:d,pages});
test('reconciles all four frozen codes across completed date pages, including missing and no trade',()=>{
 const r=parse(make([bar(),noTrade(),bar('99990')],[bar('37530')]));
 assert.equal(r.paginationComplete,true);
 assert.equal(r.expectedFrozenCodes,4);
 assert.equal(r.counts.DAILY_BAR,2);
 assert.equal(r.counts.NO_TRADE,1);
 assert.equal(r.counts.MISSING_PROVIDER_ROW,1);
 assert.equal(r.structurallyUsableRawBars,2);
 assert.deepEqual(r.outsideFrozenCodes,['9999']);
 assert.equal(r.rows.find(x=>x.code==='186A').bar,null);
 assert.equal(r.rows.find(x=>x.code==='9984').status,'MISSING_PROVIDER_ROW');
 assert.equal(r.eligibleForForwardSignal,false);
 assert.equal(r.providerRightsVerified,false);
});
test('never use retroactively adjusted prices as a raw historical feature',()=>{
 const r=parse(make([bar('13010',{AdjO:1,AdjC:100000,AdjVo:1})],[]));
 const v=r.rows.find(x=>x.code==='1301').bar;
 assert.deepEqual(v,{tradeDate:date,code:'1301',open:100,high:103,low:99,close:102,volume:20000,unadjusted:true});
 assert.equal(r.adjustedHistoricalAsOfValidated,false);
});
test('truncated pagination blocks ALL usable rows instead of hiding unfetched losers',()=>{
 const r=parse(make().slice(0,1));
 assert.equal(r.paginationComplete,false);
 assert.equal(r.failures[0].reason,'TRUNCATED_PAGINATION');
 assert.equal(r.counts.BLOCKED_PAGINATION,4);
 assert.equal(r.structurallyUsableRawBars,0);
 assert.ok(r.rows.every(x=>x.bar===null));
});
test('broken, repeated, and post-terminal pagination fail closed',()=>{
 const wrong=make();wrong[1].requestPaginationKey='OTHER';
 assert.equal(parse(wrong).failures[0].reason,'BROKEN_PAGINATION_CHAIN');
 const repeat=make();repeat[1].response.pagination_key='NEXT';
 assert.equal(parse(repeat).failures[0].reason,'REPEATED_PAGINATION_KEY');
 const done=[{requestPaginationKey:null,receivedAt:'2026-11-18T08:00:00Z',
   response:{data:[bar()]}}, ...make()];
 assert.equal(parse(done).failures[0].reason,'PAGE_AFTER_TERMINAL');
});
test('identical normalized code-date on separate pages is quarantined',()=>{
 const r=parse(make([bar('13010')],[bar('1301')]));
 assert.deepEqual(r.duplicateCodeDates,['1301:'+date]);
 assert.equal(r.rows.find(x=>x.code==='1301').status,'DUPLICATE_CODE_DATE');
 assert.equal(r.structurallyUsableRawBars,0);
});
test('non-traded null day is separate from an invalid partial OHLCV row',()=>{
 const r=parse(make([noTrade(),bar('186A0',{O:null,H:103,L:99,C:102,Vo:200})],[]));
 assert.equal(r.rows.find(x=>x.code==='1301').status,'NO_TRADE');
 assert.equal(r.rows.find(x=>x.code==='186A').status,'INVALID_OHLCV');
});
test('rejects impossible OHLCV geometry and zero-volume trade instead of invented profit',()=>{
 for (const mutate of [{H:1},{L:200},{Vo:0},{C:NaN},{O:-2}]){
  const r=parse(make([bar('13010',mutate)],[]));
  assert.equal(r.rows.find(x=>x.code==='1301').status,'INVALID_OHLCV');
 }
});
test('wrong trade date, different security class, and malformed code cannot enter frozen sample',()=>{
 const r=parse(make([
  bar('13010',{Date:'2026-11-05'}),bar('37531'),bar('foo'),bar('186A0')
 ],[]));
 assert.equal(r.unmappedRows.length,3);
 assert.equal(r.rows.find(x=>x.code==='1301').status,'MISSING_PROVIDER_ROW');
 assert.equal(r.rows.find(x=>x.code==='3753').status,'MISSING_PROVIDER_ROW');
 assert.equal(r.rows.find(x=>x.code==='186A').status,'DAILY_BAR');
});
test('invalid receipt before Japan close or malformed envelope blocks entire page series',()=>{
 const early=make();early[0].receivedAt='2026-11-04T06:00:00Z';
 const r=parse(early);
 assert.equal(r.failures[0].reason,'INVALID_OR_EARLY_RECEIPT');
 assert.equal(r.counts.BLOCKED_PAGINATION,4);
 const malformed=make();malformed[1].response={bars:[]};
 assert.equal(parse(malformed).failures[0].reason,'INVALID_RESPONSE_ENVELOPE');
});
test('historical delay does not imply an actionable next-open signal',()=>{
 const r=parse(make());
 assert.equal(r.paginationComplete,true);
 assert.equal(r.eligibleForForwardSignal,false);
 assert.equal(r.eligibleForNotifications,false);
 assert.equal(r.verifiedOriginalProviderCapture,false);
 assert.equal(r.eligibleForProduction,false);
});
test('freeze and exact date are checked, not patched with an inferred trade day',()=>{
 assert.throws(()=>parse(make(),freeze(),'2026-11-31'),TypeError);
 const f=freeze();f.codes=['1301','1301'];f.populationSize=2;
 assert.throws(()=>parse(make(),f),TypeError);
 assert.throws(()=>parse([]),TypeError);
});
