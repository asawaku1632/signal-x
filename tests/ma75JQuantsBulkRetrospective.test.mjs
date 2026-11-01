import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMa75BulkArgs,validateMa75OriginalTseCalendar,
 runMa75BulkResearch,validateMa75SavedDailyForReplay,readMa75PrivateSavedDate} from '../scripts/research/ma75-jquants-bulk-retrospective.mjs';
const from='2026-05-01',to='2026-10-30';
const argv=['--from='+from,'--to='+to];
test('default is zero network calls and zero credential dependency',async()=>{
 let n=0;
 const r=await runMa75BulkResearch(argv,{
  env:{},clock:()=>new Date('2026-11-01T00:00:00Z'),
  fetchImpl:async()=>{n++;throw new Error('unexpected')}
 });
 assert.equal(r.status,'DRY_RUN');
 assert.equal(n,0);
 assert.equal(r.eligibleForProduction,false);
});
test('explicit execution also requires private approved key, no probing without it',async()=>{
 let n=0;
 await assert.rejects(()=>runMa75BulkResearch([...argv,'--execute'],{
  clock:()=>new Date('2026-11-01T00:00:00Z'),
  env:{JQUANTS_API_KEY:'mock'},
  fetchImpl:async()=>{n++;throw new Error('unexpected')}
 }),/EXPLICIT_CONSENT/);
 assert.equal(n,0);
});
test('invalid historical range, duplicate execute, unknown flags are rejected',()=>{
 for(const bad of [
  ['--from=2026-05-01','--to=2026-04-01'],
  ['--from=2026-11-31','--to=2026-12-01'],
  [...argv,'--price-plan=PLUS'],
  [...argv,'--execute','--execute'],
  ['--from=2025-01-01','--to=2026-10-30'],
  [...argv,'--to=2026-10-30']
 ])assert.throws(()=>parseMa75BulkArgs(bad),TypeError);
});
test('real-date calendar must cover weekends and holidays, not just winning dates',()=>{
 const data=[];
 for(let t=Date.parse(from+'T00:00:00Z');t<=Date.parse(to+'T00:00:00Z');t+=86400000){
  const date=new Date(t).toISOString().slice(0,10);
  const dow=new Date(t).getUTCDay();
  data.push({Date:date,HolDiv:dow===0||dow===6?'0':'1'});
 }
 const dates=validateMa75OriginalTseCalendar(data,from,to);
 assert.equal(dates.length,130);
 assert.equal(dates.at(-1),to);
 assert.throws(()=>validateMa75OriginalTseCalendar(data.slice(1),from,to),/MISSING/);
 const dup=[...data,{...data[1]}];
 assert.throws(()=>validateMa75OriginalTseCalendar(dup,from,to),/DUPLICATE/);
});
test('even mock provider JSON cannot be obtained without explicit execution',async()=>{
 let called=0;
 const run=await runMa75BulkResearch(argv,{
  clock:()=>new Date('2026-11-01T00:00:00Z'),
  fetchImpl:async()=>{called++;return {ok:true,json:async()=>({data:[]})}},
  readFreeze:()=>{throw Error('never read')}
 });
 assert.equal(run.networkRequests,0);
 assert.equal(called,0);
});

const syntheticFreeze=()=>{
 return {
  schemaVersion:'ma75-forward-universe-candidate-freeze-v1',
  frozenAt:'2026-10-31T13:43:02.737Z',firstEligibleSignalDate:'2026-11-02',
  populationSize:2,codes:['1301','186A'],
  selectionSQL:"SELECT DISTINCT code FROM public.daily_stock_results WHERE date = '2026-10-30'",
  historicalSelectionBias:'App-observed frozen population and not an exchange-complete cohort.',
  sourceChecks:{providerRights:'UNVERIFIED',barCaptureTimestamps:'UNVERIFIED',
    splitAdjustments:'UNVERIFIED',officialTradingCalendar:'UNVERIFIED',
    liquidityCoverage:'UNVERIFIED'},
  automaticCollectionEnabled:false,liveTradingEligible:false,
  notificationEligible:false,independentlyValidatedForwardReturns:0
 };
};
const savedBar=(code,date)=>({Code:code,Date:date,O:100,H:101,L:99,C:100,Vo:1000,AdjFactor:1,ExRT:null});
const savedDate=(date,rows)=>({
 version:'ma75_one_date_original_capture_v1',
 date,requestScope:'ALL_LISTED_ONE_DATE',
 completeProviderPagination:true,eligibleForProduction:false,eligibleForNotifications:false,
 originalProviderRows:rows.length,
 frozenRows:rows.filter(r=>['13010','186A0'].includes(r.Code)).length,
 outsideFrozenRows:rows.filter(r=>!['13010','186A0'].includes(r.Code)).length,
 pages:[{requestPaginationKey:null,receivedAt:'2026-11-01T08:00:00Z',response:{data:rows}}]
});
test('private cached day must match source date, raw totals and original pagination before re-use',()=>{
 const date='2026-10-30',saved=savedDate(date,[savedBar('13010',date),savedBar('186A0',date),savedBar('99990',date)]);
 const r=validateMa75SavedDailyForReplay(syntheticFreeze(),date,saved);
 assert.equal(r.originalAllListedRows,3);
 assert.equal(r.projectedFrozenRows,2);
 const forged={...saved,originalProviderRows:999};
 assert.throws(()=>validateMa75SavedDailyForReplay(syntheticFreeze(),date,forged),/INTEGRITY/);
 assert.throws(()=>validateMa75SavedDailyForReplay(syntheticFreeze(),'2026-10-29',saved),/UNTRUSTED/);
 const corrupt=structuredClone(saved);
 corrupt.pages[0].response.data[0].Date='2026-10-29';
 assert.throws(()=>validateMa75SavedDailyForReplay(syntheticFreeze(),date,corrupt),TypeError);
});
test('outside research-private cached path fails closed before touching local files',()=>{
 for(const file of ['docs/provider.json','../outside.json','research-private/../public/cached.json'])
  assert.throws(()=>readMa75PrivateSavedDate(file),/OUTSIDE_PRIVATE/);
});
