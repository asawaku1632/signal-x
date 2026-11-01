import test from 'node:test';
import assert from 'node:assert/strict';
import {runMa75BulkResearch}
 from '../scripts/research/ma75-jquants-bulk-retrospective.mjs';
const from='2026-05-01',to='2026-10-30';
test('approved mock calendar + 130 full-market dates generate retrospective outcomes without cloud writes',async()=>{
 const cal=[],weekday=[];
 for(let t=Date.parse(from+'T00:00:00Z');t<=Date.parse(to+'T00:00:00Z');t+=86400000){
  const d=new Date(t),date=d.toISOString().slice(0,10),w=d.getUTCDay();
  const isTrading=w!==0&&w!==6;
  cal.push({Date:date,HolDiv:isTrading?'1':'0'});
  if(isTrading)weekday.push(date);
 }
 const dates=weekday.slice(-130);
 const idx=new Map(dates.map((d,i)=>[d,i]));
 const frozen=()=>({
  schemaVersion:'ma75-forward-universe-candidate-freeze-v1',
  frozenAt:'2026-10-31T13:43:02.737Z',
  firstEligibleSignalDate:'2026-11-02',populationSize:2,
  codes:['1301','186A'],
  selectionSQL:"SELECT DISTINCT code FROM public.daily_stock_results WHERE date = '2026-10-30'",
  historicalSelectionBias:'Fixed app observed stock sample and not all listed exchange stocks.',
  sourceChecks:{providerRights:'UNVERIFIED',barCaptureTimestamps:'UNVERIFIED',
   splitAdjustments:'UNVERIFIED',officialTradingCalendar:'UNVERIFIED',
   liquidityCoverage:'UNVERIFIED'},
  automaticCollectionEnabled:false,liveTradingEligible:false,
  notificationEligible:false,independentlyValidatedForwardReturns:0
 });
 let calReq=0,stockReq=0,pauseCalls=0;
 const x=await runMa75BulkResearch([
  '--from='+from,'--to='+to,'--execute'
 ],{
  env:{SIGNALX_RESEARCH_ALLOW_JQUANTS_READONLY:'YES',JQUANTS_API_KEY:'mock-private-key'},
  persist:false,readFreeze:frozen,clock:()=>new Date('2026-11-01T10:00:00Z'),
  pause:async()=>{pauseCalls++},
  fetchImpl:async(url,options)=>{
   assert.equal(options.headers['x-api-key'],'mock-private-key');
   if(url.pathname==='/v2/markets/calendar'){
    calReq++;return {ok:true,json:async()=>({data:cal})};
   }
   assert.equal(url.pathname,'/v2/equities/bars/daily');
   assert.equal(url.searchParams.has('code'),false);
   stockReq++;
   const date=url.searchParams.get('date'),n=idx.get(date);
   assert.ok(Number.isInteger(n));
   const px=n>=80?105:100;
   const bar=(Code,value)=>({
    Date:date,Code,O:value,H:value+1,L:value-1,C:value,Vo:1000,
    AdjFactor:1,ExRT:null
   });
   return {ok:true,json:async()=>({data:[
    bar('13010',px),bar('186A0',100),bar('99990',100)
   ]})};
  }
 });
 assert.equal(x.status,'HISTORICAL_ONLY');
 assert.equal(calReq,1);
 assert.equal(stockReq,130);
 assert.equal(pauseCalls,129);
 assert.equal(x.sessions,130);
 assert.equal(x.freezeSize,2);
 assert.equal(x.fullHistoryCodes,2);
 assert.equal(x.originalAllListedRows,390);
 const baseline=x.results.find(s=>s.kind==='BREAKOUT');
 assert.ok(baseline.signals>=1);
 assert.ok(baseline.completed>=1);
 assert.equal(x.validatedForwardReturns,undefined);
 assert.equal(x.independentlyValidatedWinRate,null);
 assert.equal(x.eligibleForProduction,false);
 assert.equal(x.eligibleForNotifications,false);
 assert.equal(JSON.stringify(x).includes('mock-private-key'),false);
});

test('realistic mixed saved-day resume skips exactly the already captured originals',async()=>{
 const cal=[],daylist=[];
 const from='2026-05-01',to='2026-10-30';
 for(let n=Date.parse(from+'T00:00:00Z');n<=Date.parse(to+'T00:00:00Z');n+=86400000){
   const d=new Date(n),str=d.toISOString().slice(0,10),valid=d.getUTCDay()>0&&d.getUTCDay()<6;
   cal.push({Date:str,HolDiv:valid?'1':'0'});
   if(valid)daylist.push(str);
 }
 const chosen=daylist.slice(-130);
 const source=(date)=>{
  const row=Code=>({Date:date,Code,O:100,H:101,L:99,C:100,Vo:1000,AdjFactor:1,ExRT:null});
  return {version:'ma75_one_date_original_capture_v1',date,
   requestScope:'ALL_LISTED_ONE_DATE',completeProviderPagination:true,
   eligibleForProduction:false,eligibleForNotifications:false,
   originalProviderRows:3,frozenRows:2,outsideFrozenRows:1,
   pages:[{requestPaginationKey:null,receivedAt:'2026-11-01T10:00:00Z',
    response:{data:[row('13010'),row('186A0'),row('99990')]}}]};
 };
 const files=new Map(chosen.slice(0,50).map(date=>
   ['research-private/'+date+'-jquants-daily.json',source(date)]
 ));
 const freeze={
   schemaVersion:'ma75-forward-universe-candidate-freeze-v1',
   frozenAt:'2026-10-31T13:43:02.737Z',
   firstEligibleSignalDate:'2026-11-02',populationSize:2,codes:['1301','186A'],
   selectionSQL:"SELECT DISTINCT code FROM public.daily_stock_results WHERE date = '2026-10-30'",
   historicalSelectionBias:'Application selected cohort not complete exchange listed population.',
   sourceChecks:{providerRights:'UNVERIFIED',barCaptureTimestamps:'UNVERIFIED',
    splitAdjustments:'UNVERIFIED',officialTradingCalendar:'UNVERIFIED',
    liquidityCoverage:'UNVERIFIED'},
   automaticCollectionEnabled:false,liveTradingEligible:false,
   notificationEligible:false,independentlyValidatedForwardReturns:0
 };
 let called=0,downloaded=0,ensures=0;
 const result=await runMa75BulkResearch([
   '--from='+from,'--to='+to,'--execute'
 ],{
   env:{SIGNALX_RESEARCH_ALLOW_JQUANTS_READONLY:'YES',JQUANTS_API_KEY:'mock'},
   clock:()=>new Date('2026-11-01T10:00:00Z'),
   readFreeze:()=>freeze,ensurePrivate:()=>{ensures++},
   readCached:path=>files.get(path)??null,
   writePrivate:(path,data)=>{if(files.has(path))throw Error('OVERWRITE');
    files.set(path,data);},
   pause:async()=>{},
   fetchImpl:async url=>{
    if(url.pathname==='/v2/markets/calendar')return {ok:true,json:async()=>({data:cal})};
    called++;return {ok:true,json:async()=>source(url.searchParams.get('date')).pages[0].response};
   }
 });
 assert.equal(ensures,1);
 assert.equal(called,80);
 assert.equal(result.previouslySavedDates,50);
 assert.equal(result.newlyDownloadedDates,80);
 assert.equal(result.structurallyCompleteFrozenUniverse,true);
 assert.ok(Array.isArray(result.results));
 assert.equal(downloaded,0);
 assert.equal(result.eligibleForProduction,false);
});
test('a missing frozen security is counted and full-953-like headline returns are withheld',async()=>{
 const cal=[],from='2026-05-01',to='2026-10-30';
 for(let n=Date.parse(from+'T00:00:00Z');n<=Date.parse(to+'T00:00:00Z');n+=86400000){
  const d=new Date(n),date=d.toISOString().slice(0,10),wd=d.getUTCDay();
  cal.push({Date:date,HolDiv:wd===0||wd===6?'0':'1'});
 }
 const freeze={
  schemaVersion:'ma75-forward-universe-candidate-freeze-v1',
  frozenAt:'2026-10-31T13:43:02.737Z',
  firstEligibleSignalDate:'2026-11-02',populationSize:2,codes:['1301','186A'],
  selectionSQL:"SELECT DISTINCT code FROM public.daily_stock_results WHERE date = '2026-10-30'",
  historicalSelectionBias:'Earlier selected app-observed cohort; not unbiased historical all-TSE listings',sourceChecks:{
   providerRights:'UNVERIFIED',barCaptureTimestamps:'UNVERIFIED',splitAdjustments:'UNVERIFIED',
   officialTradingCalendar:'UNVERIFIED',liquidityCoverage:'UNVERIFIED'},
  automaticCollectionEnabled:false,liveTradingEligible:false,
  notificationEligible:false,independentlyValidatedForwardReturns:0
 };
 const result=await runMa75BulkResearch(['--from='+from,'--to='+to,'--execute'],{
  env:{SIGNALX_RESEARCH_ALLOW_JQUANTS_READONLY:'YES',JQUANTS_API_KEY:'mock'},
  persist:false,readFreeze:()=>freeze,clock:()=>new Date('2026-11-01T10:00:00Z'),
  pause:async()=>{},
  fetchImpl:async url=>{
   if(url.pathname==='/v2/markets/calendar')return {ok:true,json:async()=>({data:cal})};
   const date=url.searchParams.get('date'),r=Code=>({Date:date,Code,O:100,H:101,L:99,C:100,Vo:1000,AdjFactor:1,ExRT:null});
   return {ok:true,json:async()=>({data:[r('13010'),r('99990')]})};
  }
 });
 assert.equal(result.incompleteCodes,1);
 assert.equal(result.unavailableFrozenCodeSessionCounts.MISSING_PROVIDER_ROW,result.sessions);
 assert.equal(result.structurallyCompleteFrozenUniverse,false);
 assert.equal(result.partialCohortStatisticsWithheld,true);
 assert.equal(result.results,null);
 assert.equal(result.paired,null);
});
