import test from 'node:test';
import assert from 'node:assert/strict';
import {auditMa75OriginalDailyBundle,MA75_ORIGINAL_DAILY_BUNDLE_VERSION}
 from '../app/lib/research/ma75OriginalDailyBundle.mjs';
import {parseMa75BundleArgs,summarizeMa75BundleFiles} from '../scripts/research/ma75-offline-daily-bundle.mjs';

const freeze=()=>({
 schemaVersion:'ma75-forward-universe-candidate-freeze-v1',
 frozenAt:'2026-10-31T13:43:02.737Z',firstEligibleSignalDate:'2026-11-02',
 populationSize:2,codes:['1301','186A'],
 selectionSQL:"SELECT DISTINCT code FROM public.daily_stock_results WHERE date = '2026-10-30'",
 historicalSelectionBias:'App-observed sample and not a certified exchange-wide universe.',
 sourceChecks:{providerRights:'UNVERIFIED',barCaptureTimestamps:'UNVERIFIED',
 splitAdjustments:'UNVERIFIED',officialTradingCalendar:'UNVERIFIED',
 liquidityCoverage:'UNVERIFIED'},
 automaticCollectionEnabled:false,liveTradingEligible:false,
 notificationEligible:false,independentlyValidatedForwardReturns:0
});
const sessions=()=>{
 const days=[];
 for(let t=Date.parse('2026-07-01T00:00:00Z');
     t<=Date.parse('2026-11-04T00:00:00Z');t+=86400000){
  const date=new Date(t).toISOString().slice(0,10),wd=new Date(t).getUTCDay();
  if(wd!==0&&wd!==6&&date!=='2026-11-03')days.push(date);
 }
 return days.slice(-76);
};
const record=(date,code,close=100)=>({
 Date:date,Code:code,O:close,H:close+1,L:close-1,C:close,Vo:1000,
 AdjFactor:1,ExRT:null
});
const page=(date,rows,key=null)=>({
 requestPaginationKey:null,receivedAt:'2026-12-01T10:00:00Z',
 response:{data:rows,...(key===null?{}:{pagination_key:key})}
});
const fixture=()=>{
 const dates=sessions(),valid=new Set(dates),records=[];
 for(let t=Date.parse(dates[0]+'T00:00:00Z');
     t<=Date.parse(dates.at(-1)+'T00:00:00Z');t+=86400000){
  const d=new Date(t).toISOString().slice(0,10);
  records.push({Date:d,HolDiv:valid.has(d)?'1':'0'});
 }
 return {schemaVersion:MA75_ORIGINAL_DAILY_BUNDLE_VERSION,
  sessions:dates,calendarSnapshot:{
   requestFrom:dates[0],requestTo:dates.at(-1),
   capturedAt:'2026-12-01T10:00:00Z',records
  },
  dayPages:dates.map((date,i)=>({date,pages:[page(date,[
   record(date,'13010',i===75?105:100),
   record(date,'186A0')
  ])]}))
 };
};
const audit=(bundle,asOf='2026-12-01T10:05:00Z')=>
 auditMa75OriginalDailyBundle(freeze(),bundle,{asOf});
test('76 source envelopes and raw calendar produce only historical hypothetical summary',()=>{
 const r=audit(fixture());
 assert.equal(r.structural76DayCoverage,true);
 assert.equal(r.submittedDateCaptures,76);
 assert.equal(r.expectedCodeSessionCells,152);
 assert.equal(r.originalProviderRowsRecorded,152);
 assert.equal(r.hypotheticalOfflineCrossoverCount,1);
 assert.equal(r.stockStatusCounts.NO_CROSS_OFFLINE_ONLY,1);
 assert.equal(r.eligibleForTrading,false);
 assert.equal(r.eligibleForNotifications,false);
 assert.equal(r.eligibleForProduction,false);
 assert.equal(r.validatedForwardWinRate,null);
});
test('missing one of 76 original daily responses never reports a winner count',()=>{
 const f=fixture();f.dayPages.splice(20,1);
 const r=audit(f);
 assert.equal(r.structural76DayCoverage,false);
 assert.equal(r.missingDateCaptures.length,1);
 assert.equal(r.hypotheticalOfflineCrossoverCount,null);
});
test('date-only provider extra listings are counted, excluded and never become frozen candidates',()=>{
 const f=fixture();
 f.dayPages[25].pages[0].response.data.push(record(f.sessions[25],'99990'));
 const r=audit(f);
 assert.equal(r.structural76DayCoverage,true);
 assert.equal(r.originalProviderRowsRecorded,153);
 assert.equal(r.projectedFrozenRowsRecorded,152);
 assert.equal(r.excludedUnselectedListingRows,1);
 assert.equal(r.hypotheticalOfflineCrossoverCount,1);
 assert.equal(r.eligibleForProduction,false);
});
test('wrong source trade date prevents 76-date coverage',()=>{
 const f=fixture();f.dayPages[20].pages[0].response.data[0].Date=f.sessions[21];
 assert.throws(()=>audit(f),TypeError);
});
test('original provider continuation not fetched cannot count as complete history',()=>{
 const f=fixture();f.dayPages[15].pages[0].response.pagination_key='NEXT';
 const r=audit(f);
 assert.equal(r.structural76DayCoverage,false);
 assert.equal(r.hypotheticalOfflineCrossoverCount,null);
});
test('corporate-action factor blocks a stock and hides population-level winner count',()=>{
 const f=fixture();f.dayPages[15].pages[0].response.data[0].AdjFactor=.5;
 const r=audit(f);
 assert.equal(r.structural76DayCoverage,false);
 assert.equal(r.hypotheticalOfflineCrossoverCount,null);
});
test('no-trade row blocks full SMA75 warmup without inventing a losing trade',()=>{
 const f=fixture(),v=f.dayPages[15].pages[0].response.data[0];
 v.O=null;v.H=null;v.L=null;v.C=null;v.Vo=null;
 const r=audit(f);
 assert.equal(r.structural76DayCoverage,false);
 assert.equal(r.hypotheticalOfflineCrossoverCount,null);
});
test('missing raw TSE calendar blocks every result',()=>{
 const f=fixture();delete f.calendarSnapshot;
 const r=audit(f);
 assert.equal(r.calendarStructuralPass,false);
 assert.equal(r.structural76DayCoverage,false);
});
test('changed TSE HolDiv trading-day classification blocks the replay',()=>{
 const f=fixture();f.calendarSnapshot.records.find(x=>x.Date===f.sessions[12]).HolDiv='3';
 const r=audit(f);
 assert.equal(r.calendarStructuralPass,false);
 assert.equal(r.structural76DayCoverage,false);
});
test('duplicate or out-of-window date-page records cannot be silently selected',()=>{
 const a=fixture();a.dayPages.push({...a.dayPages[1]});
 assert.throws(()=>audit(a),TypeError);
 const b=fixture();b.dayPages[6].date='2026-12-01';
 assert.throws(()=>audit(b),TypeError);
});
test('extra daily pages, oversized provider arrays, and malformed bundle are quarantined',()=>{
 const a=fixture();a.dayPages[2].pages=Array(51).fill(a.dayPages[2].pages[0]);
 assert.throws(()=>audit(a),TypeError);
 const b=fixture();b.dayPages[2].pages[0].response.data=Array(10001).fill({});
 assert.throws(()=>audit(b),TypeError);
 const c=fixture();c.schemaVersion='ma75_original_daily_bundle_v999';
 assert.throws(()=>audit(c),TypeError);
});
test('CLI requires distinct JSON input/output and refuses extra flags',()=>{
 assert.deepEqual(parseMa75BundleArgs(['--input=/tmp/source.json','--output=/tmp/report.json']),
  {input:'/tmp/source.json',output:'/tmp/report.json'});
 for(const flags of [
  ['--input=a.json','--output=a.json'],
  ['--input=a.json','--output=b.json','--execute'],
  ['--input=a.json'],
  ['--input=a.txt','--output=b.json'],
  ['--input=a.json','--output=b.json','--output=c.json'],
 ]){
  assert.throws(()=>parseMa75BundleArgs(flags),TypeError);
 }
});

test('valid non-ordinary share classes outside frozen cohort are not substituted for ordinary shares',()=>{
 const f=fixture();
 f.dayPages[10].pages[0].response.data.push(record(f.sessions[10],'13011'));
 const r=audit(f);
 assert.equal(r.structural76DayCoverage,true);
 assert.equal(r.excludedUnselectedListingRows,1);
 assert.equal(r.eligibleForTrading,false);
});
test('wrong dated unselected listing is still rejected, not silently discarded',()=>{
 const f=fixture();
 f.dayPages[10].pages[0].response.data.push(record(f.sessions[9],'99990'));
 assert.throws(()=>audit(f),TypeError);
});
test('duplicate unselected provider listing is rejected before projection',()=>{
 const f=fixture(),d=f.sessions[10];
 f.dayPages[10].pages[0].response.data.push(record(d,'99990'),record(d,'99990'));
 assert.throws(()=>audit(f),TypeError);
});
test('same ordinary stock returned under four- and five-character forms is rejected',()=>{
 const f=fixture();
 f.dayPages[10].pages[0].response.data.push(record(f.sessions[10],'1301'));
 assert.throws(()=>audit(f),TypeError);
});
test('missing frozen symbol cannot be made complete by a different valid TSE security',()=>{
 const f=fixture(),day=f.dayPages[10];
 day.pages[0].response.data[0]=record(f.sessions[10],'99990');
 const r=audit(f);
 assert.equal(r.structural76DayCoverage,false);
 assert.equal(r.hypotheticalOfflineCrossoverCount,null);
});

test('missing or malformed as-of clock is rejected even for apparently complete saved history',()=>{
 const f=fixture();
 for(const supplied of [undefined,'no-time','2026-11-04','2026-11-04T08:30:00']){
  assert.throws(()=>auditMa75OriginalDailyBundle(freeze(),f,{asOf:supplied}),TypeError);
 }
});
test('future study date is not a historical signal relative to audit time',()=>{
 const f=fixture();
 assert.throws(()=>audit(f,'2026-11-01T02:00:00Z'),/NOT_PUBLISHED/);
 assert.throws(()=>audit(f,'2026-11-04T07:29:59Z'),/NOT_PUBLISHED/);
});
test('later daily publication cannot be certified by observing market close',()=>{
 const f=fixture();
 assert.throws(()=>audit(f,'2026-11-04T06:31:00Z'),/NOT_PUBLISHED/);
});
test('provider pages claiming receipts after as-of are not treated as prior information',()=>{
 const f=fixture();
 assert.throws(()=>audit(f,'2026-11-30T10:00:00Z'),/ORIGINAL_PAGE_RECEIPT_AFTER_AUDIT_ASOF/);
 const actual=audit(f,'2026-12-01T10:00:00Z');
 assert.equal(actual.auditAsOf,'2026-12-01T10:00:00.000Z');
 assert.equal(actual.structural76DayCoverage,true);
 assert.equal(actual.pointInTimeAvailabilityVerified,false);
});
test('unknown timezone and forged future single-page capture cannot raise study coverage',()=>{
 const f=fixture();
 f.dayPages[5].pages[0].receivedAt='2026-12-02T00:00:00Z';
 assert.throws(()=>audit(f),/ORIGINAL_PAGE_RECEIPT_AFTER_AUDIT_ASOF/);
 f.dayPages[5].pages[0].receivedAt='2026-12-01T10:00:00';
 assert.throws(()=>audit(f),/ORIGINAL_PAGE_RECEIPT_AFTER_AUDIT_ASOF/);
});
test('calendar captured in the future or without an offset cannot verify old stock dates',()=>{
 for(const v of ['2026-12-02T10:00:00Z','2026-12-01T10:00:00']){
  const f=fixture();f.calendarSnapshot.capturedAt=v;
  assert.throws(()=>audit(f),/TSE_CALENDAR_CAPTURE/);
 }
});
test('CLI refuses future as-of without writing to disk, then saves historical aggregate exclusively',()=>{
 const f=fixture();
 const input='/tmp/frozen-test-source.json',output='/tmp/frozen-test-output.json';
 const writes=[];
 const args={input,output};
 const deps={
  stat:()=>({isFile:()=>true,isSymbolicLink:()=>false,size:4000}),
  read:path=>path===input?JSON.stringify(f):JSON.stringify(freeze()),
  write:(path,data,options)=>writes.push({path,json:JSON.parse(data),options}),
  now:()=>new Date('2026-11-01T02:00:00Z'),
 };
 assert.throws(()=>summarizeMa75BundleFiles(args,deps),/NOT_PUBLISHED/);
 assert.equal(writes.length,0);
 deps.now=()=>new Date('2026-12-01T10:05:00Z');
 const r=summarizeMa75BundleFiles(args,deps);
 assert.equal(r.structural76DayCoverage,true);
 assert.equal(r.auditAsOf,'2026-12-01T10:05:00.000Z');
 assert.equal(writes.length,1);
 assert.equal(writes[0].options.flag,'wx');
 assert.equal(writes[0].options.mode,0o600);
 assert.equal(writes[0].json.eligibleForNotifications,false);
 assert.equal(JSON.stringify(writes[0].json).includes('AdjFactor'),false);
});
test('bad system clock fails safely and never saves an apparent signal',()=>{
 const f=fixture(),written=[];
 assert.throws(()=>summarizeMa75BundleFiles({input:'a.json',output:'b.json'},{
  stat:()=>({isFile:()=>true,isSymbolicLink:()=>false,size:100}),
  read:path=>path==='a.json'?JSON.stringify(f):JSON.stringify(freeze()),
  write:(...args)=>written.push(args),
  now:()=>new Date(NaN)
 }),/INVALID_AUDIT_SYSTEM_CLOCK/);
 assert.equal(written.length,0);
});
