import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildMa75FirstDayResearchFreeze} from
 '../app/lib/research/ma75FirstDayResearchFreeze.mjs';
import {runMa75FirstSessionLocal} from
 '../scripts/research/ma75-first-session-local.mjs';

const members=[...Array.from({length:24},(_,i)=>String(1400+i)),
 '1878','7172','9832'].sort();
const compound=new Set(['1878','7172','9832']);
const nonRising=new Set(['1419','1420','1421','1422','1423']);
const fixtures=()=>{
 const report={
  version:'ma75_first_forward_day_shadow_v1',
  status:'OFFLINE_SHADOW_PATTERN_REVIEW_ONLY',
  requestedSignalDate:'2026-11-02',historicalWarmupLast:'2026-10-30',
  warmupSessions:75,fixedFrozenCodes:953,
  codesWithCompletePrior75:925,blockedPrior75:28,
  blockedCurrentDayAmongCompletePrior75:0,quarantinedPriceDiscontinuity:1,
  analyzableCodeCount:924,nonBreakout:897,allBreakoutShadowCount:27,
  risingMa75BreakoutShadowCount:22,breakoutWithoutRisingCount:5,
  allBreakoutShadowPatterns:members.map(code=>({
   code,tradeDate:'2026-11-02',
   sma75Rising:!nonRising.has(code),
   historicalVolumeRatio:compound.has(code)?2:1,
   status:'CLOSE_TIME_SHADOW_PATTERN_ONLY'
  })),
  incompleteAndQuarantined:[
   ...Array.from({length:28},(_,i)=>({
    code:String(1000+i),status:'NOT_EVALUABLE',
    reason:'PRIOR_75_MISSING_PROVIDER_ROW'
   })),
   {code:'1952',status:'NOT_EVALUABLE',
    reason:'UNVERIFIED_PRICE_DISCONTINUITY'}
  ],
  snapshotAsOfNextOpenIndependentlyAuthenticated:false,
  return5Percent:null,validatedForwardWinRate:null,
  independentForwardOutcomes:0,eligibleForProduction:false,
  eligibleForNotifications:false,eligibleForTrading:false,
  eligibleForAIPowerScoring:false
 };
 report.shadowPatterns=report.allBreakoutShadowPatterns.filter(x=>x.sma75Rising);
 const frozen=buildMa75FirstDayResearchFreeze(report,{
  sourceSha256:'a'.repeat(64),historySha256:'b'.repeat(64),
  recordedAt:'2026-11-02T11:00:00.000Z'
 });
 const comp={
  status:'SHADOW_NOT_APPROVED',frozenCohortSha256:frozen.freezeSha256,
  originalAllBreakouts:27,originalRisingBreakouts:22,
  firstDayWickAndVolumeComposite:3,firstDayRisingAndComposite:3,
  notEvaluableBreakouts:0,
  perFrozenBreakout:report.allBreakoutShadowPatterns.map(x=>({
   code:x.code,risingMA75:x.sma75Rising,
   compoundMatched:compound.has(x.code),
   classification:compound.has(x.code)?
    'COMPOUND_SHADOW_MATCH':'BASELINE_BREAKOUT_ONLY'
  }))
 };
 const codes=[...members,...Array.from({length:926},(_,i)=>String(2000+i))];
 const projection={
  date:'2026-11-04',completeProviderPagination:true,
  originalAllListedRows:4445,projectedFrozenRows:953,
  audit:{failures:[],rows:codes.map(code=>({
   tradeDate:'2026-11-04',code,status:'DAILY_BAR',
   bar:{tradeDate:'2026-11-04',code,open:100,
    high:110,low:95,close:105,volume:1000}
  }))}
 };
 return {frozen,comp,projection};
};
const make=(f,{saved=null,now='2026-11-04T11:00:00.000Z'}={})=>({
 clock:()=>new Date(now),
 expectedCohortSha256:f.frozen.freezeSha256,
 fileInfo:path=>String(path).endsWith('research-private')?
  {isDirectory:()=>true,isSymbolicLink:()=>false}:
  {isFile:()=>true,isSymbolicLink:()=>false,size:5500},
 read:path=>String(path).endsWith('cohort-freeze.json')?
  JSON.stringify(f.frozen):
  JSON.stringify({populationSize:953,firstEligibleSignalDate:'2026-11-02'}),
 compare:()=>f.comp,
 readSaved:()=>saved,
 validateSaved:(_,date,value)=>{
  assert.equal(date,'2026-11-04');
  assert.equal(value,saved);
  return f.projection;
 }
});

test('missing manually acquired Nov4 original is pending for every frozen code',()=>{
 const f=fixtures(),r=runMa75FirstSessionLocal(make(f));
 assert.equal(r.status,'SHADOW_NOT_APPROVED');
 assert.equal(r.originalCodesRetained,27);
 assert.equal(r.risingCodesRetained,22);
 assert.equal(r.compoundCodesRetained,3);
 assert.equal(r.groups.allBreakouts.pending,27);
 assert.equal(r.groups.compoundBreakouts.pending,3);
 assert.equal(r.groups.allBreakouts.measured,0);
 assert.equal(r.outcomeOriginalPresent,false);
 assert.equal(r.outcomeSourceCapturedPageCount,0);
 assert.equal(r.filesWritten,0);
 assert.equal(r.networkRequests,0);
});
test('already saved original Nov4 day produces only 1-session retrospective return',()=>{
 const f=fixtures(),saved={pages:[{
  receivedAt:'2026-11-04T08:00:00Z',
  requestPaginationKey:null,response:{data:[]}
 }]};
 const r=runMa75FirstSessionLocal(make(f,{saved}));
 assert.equal(r.status,'SHADOW_NOT_APPROVED');
 assert.equal(r.groups.allBreakouts.measured,27);
 assert.equal(r.groups.risingBreakouts.measured,22);
 assert.equal(r.groups.compoundBreakouts.measured,3);
 assert.equal(r.outcomeOriginalPresent,true);
 assert.equal(r.outcomeSourceCapturedPageCount,1);
 assert.equal(r.originalNov02Sha256Pinned,true);
 assert.equal(r.groups.allBreakouts.positiveRatePercent,100);
 assert.equal(r.return3Percent,null);
 assert.equal(r.return5Percent,null);
 assert.equal(r.independentValidatedForwardOutcomes,0);
 assert.equal(r.ownerLocalFilesChanged,0);
});
test('future-dated, pre-release and malformed source receipts never become a validated result',()=>{
 const f=fixtures();
 const wrap=receivedAt=>({pages:[{
  receivedAt,requestPaginationKey:null,response:{data:[]}
 }]});
 assert.throws(()=>runMa75FirstSessionLocal(make(f,{
  saved:wrap('2026-11-04T06:00:00Z')
 })),/MA75_FIRST_SESSION_LOCAL_IMPOSSIBLE_OUTCOME_RECEIPT/);
 assert.throws(()=>runMa75FirstSessionLocal(make(f,{
  saved:wrap('2026-11-04T12:00:00Z')
 })),/MA75_FIRST_SESSION_LOCAL_IMPOSSIBLE_OUTCOME_RECEIPT/);
 assert.throws(()=>runMa75FirstSessionLocal(make(f,{
  saved:wrap('2026-11-04T08:00:00Z'),
  now:'2026-11-04T06:00:00Z'
 })),/MA75_FIRST_SESSION_LOCAL_OUTCOME_CAPTURE_BEFORE/);
});
test('same source never changes original 27/22/3 subgroup membership or permits files to be written',()=>{
 const f=fixtures();
 const changed={...f.comp,firstDayWickAndVolumeComposite:4};
 assert.throws(()=>runMa75FirstSessionLocal({
  ...make(f),compare:()=>changed
 }),/MA75_FIRST_SESSION_LOCAL_ORIGINAL_NOV02_THREE_GROUPS_CHANGED/);
 const code=readFileSync(new URL(
  '../scripts/research/ma75-first-session-local.mjs',import.meta.url),'utf8');
 const active=code.split('\n').filter(x=>!x.trimStart().startsWith('*')&&!x.trimStart().startsWith('//')).join('\n');
 assert.doesNotMatch(active,/\bfetch\s*\(|writeFileSync|process\.env|JQUANTS_API_KEY|broker|notificationSend|deploy/);
 assert.match(active,/MA75_FIRST_SESSION_LOCAL_NO_ARGUMENTS_ALLOWED/);
 assert.match(active,/LOCAL_READ_ONLY_INTEGRITY_ERROR/);
});
