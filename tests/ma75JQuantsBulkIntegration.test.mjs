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
