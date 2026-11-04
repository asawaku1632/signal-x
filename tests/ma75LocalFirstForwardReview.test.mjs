import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runMa75LocalFirstForwardReview}
 from '../scripts/research/ma75-local-first-forward-review.mjs';

const freeze=()=>({
 schemaVersion:'ma75-forward-universe-candidate-freeze-v1',
 frozenAt:'2026-10-31T13:43:02.737Z',
 firstEligibleSignalDate:'2026-11-02',
 populationSize:2,codes:['1301','186A'],
 selectionSQL:"SELECT DISTINCT code FROM public.daily_stock_results WHERE date = '2026-10-30'",
 historicalSelectionBias:'App-observed stock selection took place after retrospective history.',
 sourceChecks:{providerRights:'UNVERIFIED',barCaptureTimestamps:'UNVERIFIED',
  splitAdjustments:'UNVERIFIED',officialTradingCalendar:'UNVERIFIED',
  liquidityCoverage:'UNVERIFIED'},
 automaticCollectionEnabled:false,liveTradingEligible:false,
 notificationEligible:false,independentlyValidatedForwardReturns:0
});
// Synthetic historical date names preserve the authentic archived endpoints
// and exactly 75 original warmup sessions; no market-calendar inference.
const dayList=[
 ...Array.from({length:47},(_,i)=>new Date(
  Date.parse('2026-05-01T00:00:00Z')+i*86400000
 ).toISOString().slice(0,10)),
 ...Array.from({length:74},(_,i)=>new Date(
  Date.parse('2026-07-10T00:00:00Z')+i*86400000
 ).toISOString().slice(0,10)),
 '2026-10-30'
];
const first=dayList.at(-75);
const forwardDay='2026-11-02';
const capture=date=>{
 const row=(Code,price)=>({
  Date:date,Code,O:price,H:price+1,L:price-1,C:price,Vo:1000,
  AdjFactor:1,ExRT:null
 });
 return {
  version:'ma75_one_date_original_capture_v1',
  date,requestScope:'ALL_LISTED_ONE_DATE',
  completeProviderPagination:true,
  eligibleForProduction:false,eligibleForNotifications:false,
  originalProviderRows:3,frozenRows:2,outsideFrozenRows:1,
  pages:[{requestPaginationKey:null,receivedAt:date+'T08:00:00Z',
   response:{data:[
    row('13010',date===forwardDay?110:100),
    row('186A0',date===forwardDay?98:100),
    row('99990',100)
   ]}}]
 };
};
const archive=()=>({
 status:'OFFLINE_HISTORICAL_DIAGNOSTIC_ONLY',frozenCodes:2,
 dates:122,from:'2026-05-01',to:'2026-10-30',
 preFreeze75SessionWarmup:{requiredHistoricalSessions:75,
  sourceFirstDate:first,sourceLastDate:'2026-10-30',
  codesWithAll75ArchivedBars:2}
});
const list=()=>[
 ...dayList.map(date=>date+'-jquants-daily.json'),
 'ma75-forward-2026-11-02-jquants-daily.json'
];
const mocks=(overrides={})=>({
 read:()=>JSON.stringify(freeze()),
 files:list,
 fileInfo:()=>({isDirectory:()=>true,isSymbolicLink:()=>false}),
 readCapture:path=>{
  const match=/(20\d\d-\d\d-\d\d)-jquants-daily\.json$/.exec(path);
  return capture(match[1]);
 },
 auditArchive:archive,
 clock:()=>new Date('2026-11-02T11:00:00Z'),
 ...overrides
});

test('local first-day review joins 75 original archived pages with one distinct postfreeze file, no network',()=>{
 const r=runMa75LocalFirstForwardReview(mocks());
 assert.equal(r.requestedSignalDate,forwardDay);
 assert.equal(r.historicalWarmupLast,'2026-10-30');
 assert.equal(r.warmupSessions,75);
 assert.equal(r.codesWithCompletePrior75,2);
 assert.equal(r.fullMarketOriginalRows,3);
 assert.equal(r.frozenProjectedRows,2);
 assert.equal(r.allBreakoutShadowCount,1);
 assert.equal(r.risingMa75BreakoutShadowCount,1);
 assert.deepEqual(r.shadowPatterns.map(x=>x.code),['1301']);
 assert.equal(r.capturedOriginalPageCount,1);
 assert.equal(r.return5Percent,null);
 assert.equal(r.independentForwardOutcomes,0);
 assert.equal(r.independentlyValidatedForwardWinRate,null);
 assert.equal(r.eligibleForNotifications,false);
 assert.equal(r.eligibleForTrading,false);
 assert.equal(r.sourceRightsReviewRequired,true);
});

test('later saved J-Quants dates cannot alter original 122-session warmup',()=>{
 const original=runMa75LocalFirstForwardReview(mocks());
 const touched=[];
 const extended=runMa75LocalFirstForwardReview(mocks({
  files:()=>[...list(), '2026-11-04-jquants-daily.json',
   'ma75-forward-2026-11-04-jquants-daily.json'],
  readCapture:path=>{
   touched.push(path);
   if(path.includes('2026-11-04'))throw Error('FUTURE_DATA_MUST_NOT_BE_READ');
   return capture(/(20\d\d-\d\d-\d\d)-jquants-daily\.json$/.exec(path)[1]);
  }
 }));
 assert.deepEqual(extended.shadowPatterns,original.shadowPatterns);
 assert.equal(extended.historicalWarmupFirst,'2026-07-10');
 assert.equal(extended.allBreakoutShadowCount,original.allBreakoutShadowCount);
 assert.equal(touched.length,76);
 assert.ok(touched.every(path=>!path.includes('2026-11-04')));
 assert.throws(()=>runMa75LocalFirstForwardReview(mocks({
  files:()=>list().filter(x=>x!==dayList[4]+'-jquants-daily.json')
 })),/MA75_FIRST_FORWARD_LOCAL_UNEXPECTED_ARCHIVE_DATES/);
});

test('unpublished Nov2 day, missing private file, changed warmup and future-dated receipt all block',()=>{
 const original=mocks();
 assert.throws(()=>runMa75LocalFirstForwardReview(mocks({
  clock:()=>new Date('2026-11-02T07:20:00Z')
 })),/MA75_FIRST_FORWARD_LOCAL_PUBLISHED_DATE_NOT_REACHED/);
 assert.throws(()=>runMa75LocalFirstForwardReview(mocks({
  files:()=>dayList.map(date=>date+'-jquants-daily.json')
 })),/MA75_FIRST_FORWARD_LOCAL_FORWARD_DATE_CAPTURE_NOT_FOUND/);
 assert.throws(()=>runMa75LocalFirstForwardReview(mocks({
  auditArchive:()=>({...archive(),preFreeze75SessionWarmup:{
   ...archive().preFreeze75SessionWarmup,codesWithAll75ArchivedBars:1
  }})
 })),/MA75_FIRST_FORWARD_LOCAL_WARMUP_COUNT_DISAGREES_WITH_ARCHIVE/);
 assert.throws(()=>runMa75LocalFirstForwardReview(mocks({
  clock:()=>new Date('2026-11-02T07:40:00Z')
 })),/MA75_FIRST_FORWARD_LOCAL_FUTURE_OR_INVALID_ORIGINAL_RECEIPT/);
 assert.ok(original);
});
test('symlink directory, corrupt day capture and invalid archive refuse all shadow claims',()=>{
 assert.throws(()=>runMa75LocalFirstForwardReview(mocks({
  fileInfo:()=>({isDirectory:()=>true,isSymbolicLink:()=>true})
 })),/MA75_FIRST_FORWARD_LOCAL_PRIVATE_DIRECTORY_UNSAFE/);
 assert.throws(()=>runMa75LocalFirstForwardReview(mocks({
  readCapture:path=>{
   const match=/(20\d\d-\d\d-\d\d)-jquants-daily\.json$/.exec(path);
   const x=capture(match[1]);
   if(path.includes('ma75-forward-'))x.originalProviderRows=9000;
   return x;
  }
 })),/PREEXISTING_CAPTURE_INTEGRITY_MISMATCH/);
 assert.throws(()=>runMa75LocalFirstForwardReview(mocks({
  auditArchive:()=>({...archive(),status:'UNVERIFIED'})
 })),/MA75_FIRST_FORWARD_LOCAL_HISTORICAL_ARCHIVE_NOT_RECONCILED/);
});

test('CLI reports derived counts only, with no key or HTTP method access',()=>{
 const src=readFileSync(new URL(
  '../scripts/research/ma75-local-first-forward-review.mjs',import.meta.url),'utf8');
 const active=src.split('\n').filter(x=>!x.trimStart().startsWith('*')&&!x.trimStart().startsWith('//')).join('\n');
 assert.doesNotMatch(active,/\bfetch\s*\(|writeFileSync|unlinkSync|renameSync|process\.env|JQUANTS_API_KEY|vercel deploy/);
 assert.match(src,/runMa75LocalCompletionAudit/);
 assert.match(src,/validateMa75SavedDailyForReplay/);
 assert.match(src,/NO_ARGUMENTS_ALLOWED/);
});
