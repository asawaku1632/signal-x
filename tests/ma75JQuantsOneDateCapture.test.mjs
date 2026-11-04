import test from 'node:test';
import assert from 'node:assert/strict';
import {planMa75OneDateCapture,parseMa75OneDateCaptureArgs,
 acquireMa75OneDatePages,runMa75OneDateCapture}
 from '../scripts/research/ma75-jquants-one-date-capture.mjs';
const date='2026-10-30';
const frozen=()=>({
 schemaVersion:'ma75-forward-universe-candidate-freeze-v1',
 frozenAt:'2026-10-31T13:43:02.737Z',firstEligibleSignalDate:'2026-11-02',
 populationSize:2,codes:['1301','186A'],
 selectionSQL:"SELECT DISTINCT code FROM public.daily_stock_results WHERE date = '2026-10-30'",
 historicalSelectionBias:'Application observed subset not a certified full TSE liquid stock universe.',
 sourceChecks:{providerRights:'UNVERIFIED',barCaptureTimestamps:'UNVERIFIED',
 splitAdjustments:'UNVERIFIED',officialTradingCalendar:'UNVERIFIED',
 liquidityCoverage:'UNVERIFIED'},automaticCollectionEnabled:false,
 liveTradingEligible:false,notificationEligible:false,
 independentlyValidatedForwardReturns:0
});
const now=()=>new Date('2026-11-01T02:00:00Z');
const bar=(Code,Date=date)=>({Code,Date,O:100,H:101,L:99,C:100,Vo:100,
 AdjFactor:1,ExRT:null});
const response=(rows,next)=>({ok:true,status:200,
 json:async()=>({data:rows,...(next===undefined?{}:{pagination_key:next})})});
const args=['--date='+date,'--output=research-private/2026-10-30.json'];
test('default dry-run has zero network calls and no file or API-key reads',async()=>{
 let fetchCalls=0,writes=0;
 const r=await runMa75OneDateCapture(args,{
  env:{},clock:now,fetchImpl:async()=>{fetchCalls++;throw Error('unexpected')},
  read:()=>{throw Error('read must not run')},write:()=>writes++
 });
 assert.equal(r.status,'DRY_RUN_NO_NETWORK_NO_FILE');
 assert.equal(r.upperBoundRequests,12);
 assert.equal(fetchCalls,0);assert.equal(writes,0);
});
test('explicit execute also requires private environment consent',async()=>{
 let calls=0;
 await assert.rejects(()=>runMa75OneDateCapture([...args,'--execute'],{
  env:{JQUANTS_API_KEY:'secret'},clock:now,
  fetchImpl:async()=>{calls++;return response([])}
 }),/EXPLICIT_APPROVAL/);
 assert.equal(calls,0);
});
test('all-listed daily source returns retained two-page audit with only frozen subset',async()=>{
 const calls=[];
 const r=await acquireMa75OneDatePages(frozen(),{
  date,apiKey:'mock-key',maxPages:3,clock:now,
  fetchImpl:async(url,options)=>{
   calls.push({url:String(url),options});
   return calls.length===1?response([bar('13010'),bar('99990')],'NEXT'):
    response([bar('186A0'),bar('99991')]);
  }
 });
 assert.equal(calls.length,2);
 assert.equal(calls[0].url.includes('date=2026-10-30'),true);
 assert.equal(calls[0].url.includes('code='),false);
 assert.equal(calls[1].url.includes('pagination_key=NEXT'),true);
 assert.equal(calls[0].options.redirect,'error');
 assert.equal(r.originalProviderRows,4);
 assert.equal(r.frozenRows,2);assert.equal(r.outsideFrozenRows,2);
 assert.equal(r.completeProviderPagination,true);
 assert.equal(r.pages[1].requestPaginationKey,'NEXT');
 assert.equal(r.eligibleForNotifications,false);
});
test('never save a truncated chain at page cap',async()=>{
 let n=0;
 await assert.rejects(()=>acquireMa75OneDatePages(frozen(),{
  date,maxPages:1,apiKey:'mock',clock:now,
  fetchImpl:async()=>{n++;return response([bar('13010')],'NEXT')}
 }),/PAGE_LIMIT_REACHED/);
 assert.equal(n,1);
});
test('reject repeated continuation and duplicate stock identifiers',async()=>{
 let i=0;
 await assert.rejects(()=>acquireMa75OneDatePages(frozen(),{
  date,apiKey:'mock',clock:now,
  fetchImpl:async()=>{i++;return response(i===1?[bar('13010')]:[bar('186A0')],'NEXT')}
 }),/BAD_PAGINATION/);
 i=0;
 await assert.rejects(()=>acquireMa75OneDatePages(frozen(),{
  date,apiKey:'mock',clock:now,
  fetchImpl:async()=>{i++;return i===1?
   response([bar('13010')],'NEXT'):response([bar('13010')])}
 }),/WRONG_OR_DUPLICATE/);
});
test('foreign trade date or invalid stock code fails',async()=>{
 for(const bad of [bar('13010','2026-10-29'),bar('nonsense')]){
  await assert.rejects(()=>acquireMa75OneDatePages(frozen(),{
   date,apiKey:'mock',clock:now,fetchImpl:async()=>response([bad])
  }),/WRONG_OR_DUPLICATE/);
 }
});
test('HTTP errors and thrown fetch exception are redacted',async()=>{
 for(const status of [403,429,500])
  await assert.rejects(()=>acquireMa75OneDatePages(frozen(),{
   date,apiKey:'mock',clock:now,
   fetchImpl:async()=>({ok:false,status,json:async()=>({secret:'hidden'})})
  }),/JQUANTS_ONE_DATE_/);
 await assert.rejects(()=>acquireMa75OneDatePages(frozen(),{
  date,apiKey:'mock',clock:now,fetchImpl:async()=>{throw Error('private-key=123')}
 }),/NETWORK_OR_REDIRECT_BLOCKED/);
});
test('unpublished, malformed and unsafe date/page claims fail closed',()=>{
 for(const options of [
  {date:'2026-11-02',now:now()},
  {date,now:new Date('2026-10-30T06:00:00Z')},
  {date,now:new Date(NaN)},
  {date:'2026-11-31',now:now()},
  {date,maxPages:13,now:now()}
 ])assert.throws(()=>planMa75OneDateCapture(options),TypeError);
});
test('CLI rejects duplicate or forbidden arguments, and accepts bounded page count',()=>{
 for(const bad of [
  [...args,'--paid'],[...args,'--max-pages=0'],
  [...args,'--max-pages=13'],[...args,'--date=2026-10-30'],
  ['--date=2026-10-30','--output=nope.txt'],
  ['--output=file.json'],['--execute','--execute',...args]
 ])assert.throws(()=>parseMa75OneDateCaptureArgs(bad),TypeError);
 assert.equal(parseMa75OneDateCaptureArgs([...args,'--max-pages=3']).maxPages,3);
});
test('approved one-day capture uses exclusive private file, no raw output in summary',async()=>{
 const writes=[];
 const r=await runMa75OneDateCapture([...args,'--execute'],{
  env:{SIGNALX_RESEARCH_ALLOW_JQUANTS_READONLY:'YES',JQUANTS_API_KEY:'secret'},
  clock:now,read:()=>JSON.stringify(frozen()),
  fetchImpl:async()=>response([bar('13010'),bar('186A0'),bar('99990')]),
  write:(path,payload,opts)=>writes.push({path,capture:JSON.parse(payload),opts})
 });
 assert.equal(r.status,'ORIGINAL_ONE_DATE_SAVED_PRIVATE');
 assert.equal(r.originalRows,3);
 assert.equal(writes.length,1);
 assert.equal(writes[0].opts.flag,'wx');
 assert.equal(writes[0].opts.mode,0o600);
 assert.equal(writes[0].capture.pages[0].response.data.length,3);
 assert.equal(JSON.stringify(r).includes('secret'),false);
 assert.equal(writes[0].capture.eligibleForProduction,false);
});
test('approved run without key still makes zero requests',async()=>{
 let calls=0;
 await assert.rejects(()=>runMa75OneDateCapture([...args,'--execute'],{
  env:{SIGNALX_RESEARCH_ALLOW_JQUANTS_READONLY:'YES'},clock:now,
  fetchImpl:async()=>{calls++;return response([])}
 }),/PRIVATE_API_KEY_MISSING/);
 assert.equal(calls,0);
});
test('invalid JSON or oversized provider payload cannot produce a saved capture',async()=>{
 const sources=[
  {ok:true,json:async()=>({foo:'missing data'})},
  {ok:true,json:async()=>{throw Error('provider secret')}},
  {ok:true,json:async()=>({data:Array(10001).fill(bar('13010'))})}
 ];
 for(const src of sources)await assert.rejects(()=>acquireMa75OneDatePages(frozen(),{
  date,apiKey:'mock',clock:now,fetchImpl:async()=>src
 }),/JQUANTS_ONE_DATE_/);
});

test('bad OHLCV for a frozen code prevents private source file write',async()=>{
 const damaged={...bar('13010'),H:80};
 let writes=0;
 await assert.rejects(()=>runMa75OneDateCapture([...args,'--execute'],{
  env:{SIGNALX_RESEARCH_ALLOW_JQUANTS_READONLY:'YES',JQUANTS_API_KEY:'secret'},
  clock:now,read:()=>JSON.stringify(frozen()),
  fetchImpl:async()=>response([damaged,bar('186A0')]),
  write:()=>{writes++;}
 }),/INVALID_FROZEN_STOCK_DAY/);
 assert.equal(writes,0);
});
test('genuine no-trade and rights-review rows remain archived but not trade eligible',async()=>{
 const nt={...bar('13010'),O:null,H:null,L:null,C:null,Vo:null};
 const rights={...bar('186A0'),AdjFactor:0.5};
 const r=await acquireMa75OneDatePages(frozen(),{
  date,apiKey:'mock',clock:now,
  fetchImpl:async()=>response([nt,rights])
 });
 assert.equal(r.completeProviderPagination,true);
 assert.equal(r.eligibleForProduction,false);
 assert.equal(r.eligibleForNotifications,false);
});

test('provider original one-day file cannot be saved under tracked code or outside private directory',()=>{
 for(const path of ['docs/provider.json','public/provider.json',
  '../untracked.json','research-private/../src/provider.json']){
  assert.throws(()=>parseMa75OneDateCaptureArgs([
   '--date=2026-10-30','--output='+path
  ]),/SAFE_OUTPUT/);
 }
});
