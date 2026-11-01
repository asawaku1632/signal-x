import test from 'node:test';
import assert from 'node:assert/strict';
import {auditMa75SavedDays} from '../app/lib/research/ma75SavedDays.mjs';
import {parseSavedDayArgs,runSavedDayAudit} from '../scripts/research/ma75-saved-days-audit.mjs';
const freeze=()=>({
 schemaVersion:'ma75-forward-universe-candidate-freeze-v1',
 frozenAt:'2026-10-31T13:43:02.737Z',firstEligibleSignalDate:'2026-11-02',
 populationSize:2,codes:['1301','186A'],
 selectionSQL:"SELECT DISTINCT code FROM public.daily_stock_results WHERE date = '2026-10-30'",
 historicalSelectionBias:'Previously app-observed symbols, not complete TSE liquid-universe evidence.',
 sourceChecks:{providerRights:'UNVERIFIED',barCaptureTimestamps:'UNVERIFIED',
 splitAdjustments:'UNVERIFIED',officialTradingCalendar:'UNVERIFIED',
 liquidityCoverage:'UNVERIFIED'},automaticCollectionEnabled:false,
 liveTradingEligible:false,notificationEligible:false,
 independentlyValidatedForwardReturns:0
});
const fixture=()=>{
 const sessions=[];
 for(let t=Date.parse('2026-07-01T00:00:00Z');t<=Date.parse('2026-11-04T00:00:00Z');t+=86400000){
  const d=new Date(t),s=d.toISOString().slice(0,10);
  if(d.getUTCDay()!==0&&d.getUTCDay()!==6&&s!=='2026-11-03')sessions.push(s);
 }
 const dates=sessions.slice(-76),included=new Set(dates),records=[];
 for(let t=Date.parse(dates[0]+'T00:00:00Z');t<=Date.parse(dates.at(-1)+'T00:00:00Z');t+=86400000){
  const date=new Date(t).toISOString().slice(0,10);
  records.push({Date:date,HolDiv:included.has(date)?'1':'0'});
 }
 const calendar={requestFrom:dates[0],requestTo:dates.at(-1),
  capturedAt:'2026-12-01T10:00:00Z',records};
 const entries=dates.map(date=>({date,file:'research-private/'+date+'.json'}));
 const payloads={};
 dates.forEach((date,i)=>{
  const bar=(Code,close=100)=>({Date:date,Code,O:close,H:close+1,L:close-1,
   C:close,Vo:1000,AdjFactor:1,ExRT:null});
  payloads[entries[i].file]={
   version:'ma75_one_date_original_capture_v1',date,
   requestScope:'ALL_LISTED_ONE_DATE',completeProviderPagination:true,
   eligibleForProduction:false,eligibleForNotifications:false,
   originalProviderRows:3,frozenRows:2,outsideFrozenRows:1,
   pages:[{requestPaginationKey:null,receivedAt:'2026-12-01T10:00:00Z',
    response:{data:[bar('13010',i===75?105:100),bar('186A0'),bar('99990')]}}]
  };
 });
 return {sessions:dates,calendar,entries,payloads};
};
const audit=(f,asOf='2026-12-01T10:05:00Z')=>auditMa75SavedDays(freeze(),{
 sessions:f.sessions,entries:f.entries,calendar:f.calendar,asOf,
 load:path=>f.payloads[path]
});
test('full 76-day archive uses distinct files and never claims trade validation',()=>{
 const x=audit(fixture());
 assert.equal(x.structuralHistoricalCoverageComplete,true);
 assert.equal(x.sourceCounts.sourceRows,228);
 assert.equal(x.sourceCounts.frozenRows,152);
 assert.equal(x.hypotheticalCrossoverCount,1);
 assert.equal(x.validatedWinRate,null);
 assert.equal(x.eligibleForNotifications,false);
});
test('missing date is visible and crossover count becomes null',()=>{
 const f=fixture();f.entries.splice(3,1);
 const x=audit(f);
 assert.equal(x.missingDates.length,1);
 assert.equal(x.hypotheticalCrossoverCount,null);
});
test('duplicate date or duplicate file is quarantined',()=>{
 const f=fixture();f.entries[2]={...f.entries[1]};
 assert.throws(()=>audit(f),TypeError);
 const g=fixture();g.entries[2].file=g.entries[1].file;
 assert.throws(()=>audit(g),TypeError);
});
test('forged raw provider counts cannot inflate historical coverage',()=>{
 const f=fixture();f.payloads[f.entries[1].file].originalProviderRows=999;
 assert.throws(()=>audit(f),/SOURCE_AUDIT/);
});
test('future raw source receipt and future calendar capture both block',()=>{
 const f=fixture();f.payloads[f.entries[1].file].pages[0].receivedAt='2026-12-02T00:00:00Z';
 assert.throws(()=>audit(f),/FUTURE_SAVED_CAPTURE/);
 const g=fixture();g.calendar.capturedAt='2026-12-02T00:00:00Z';
 assert.throws(()=>audit(g),/TSE_CALENDAR/);
});
test('rights/split event does not become an observed winning breakout',()=>{
 const f=fixture();f.payloads[f.entries[1].file].pages[0].response.data[0].AdjFactor=0.5;
 const x=audit(f);
 assert.equal(x.structuralHistoricalCoverageComplete,false);
 assert.equal(x.hypotheticalCrossoverCount,null);
});
test('CLI requires private paths, not a provider file in docs or source',()=>{
 for(const a of [
  ['--manifest=docs/a.json','--output=research-private/o.json'],
  ['--manifest=research-private/a.json','--output=../o.json'],
  ['--manifest=research-private/a.json','--output=research-private/a.json'],
  ['--manifest=research-private/a.json','--output=research-private/o.txt']
 ])assert.throws(()=>parseSavedDayArgs(a),TypeError);
});
test('offline audit writes summary with exclusive flag, no raw candles',()=>{
 const f=fixture(),sources={...f.payloads};
 sources['research-private/manifest.json']={
  version:'ma75_private_day_manifest_v1',sessions:f.sessions,
  entries:f.entries,calendarFile:'research-private/calendar.json'
 };
 sources['research-private/calendar.json']=f.calendar;
 const writes=[];
 const r=runSavedDayAudit([
  '--manifest=research-private/manifest.json',
  '--output=research-private/summary.json'
 ],{
  read:path=>typeof path==='string'?JSON.stringify(sources[path]):JSON.stringify(freeze()),
  stat:()=>({isFile:()=>true,isSymbolicLink:()=>false,size:500}),
  clock:()=>new Date('2026-12-01T10:05:00Z'),
  write:(p,data,options)=>writes.push({p,body:JSON.parse(data),options})
 });
 assert.equal(r.structuralHistoricalCoverageComplete,true);
 assert.equal(writes.length,1);
 assert.equal(writes[0].options.flag,'wx');
 assert.equal(writes[0].options.mode,0o600);
 assert.equal(JSON.stringify(writes[0].body).includes('requestPaginationKey'),false);
});
test('symlinks and oversized market files fail before any parsing or writing',()=>{
 let calls=0;
 for(const symlink of [true,false])
  assert.throws(()=>runSavedDayAudit([
   '--manifest=research-private/m.json','--output=research-private/o.json'
  ],{
   stat:()=>({isFile:()=>true,isSymbolicLink:()=>symlink,
    size:symlink?100:999999999}),
   read:()=>{calls++;throw Error('not read')},
   write:()=>{throw Error('not written')}
  }),TypeError);
 assert.equal(calls,0);
});
