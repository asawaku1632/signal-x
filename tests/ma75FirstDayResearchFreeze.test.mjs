import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildMa75FirstDayResearchFreeze,verifyMa75FirstDayResearchFreeze}
 from '../app/lib/research/ma75FirstDayResearchFreeze.mjs';
import {hashMa75FirstDayOriginals,parseMa75FirstDayFreezeArgs,
 runMa75FirstDayCohortFreeze}
 from '../scripts/research/ma75-freeze-first-forward-day.mjs';

const sha='a'.repeat(64),hist='b'.repeat(64),received='2026-11-02T09:00:00.000Z';
const report=()=>{
 const make=(code,sma75Rising)=>({
  code,tradeDate:'2026-11-02',sma75Rising,
  historicalVolumeRatio:1,
  status:'CLOSE_TIME_SHADOW_PATTERN_ONLY'
 });
 const group=Array.from({length:27},(_,i)=>make(String(1300+i),i<22));
 const exclusions=[
  ...Array.from({length:28},(_,i)=>({
   code:String(1000+i),status:'NOT_EVALUABLE',reason:'PRIOR_75_MISSING_PROVIDER_ROW'
  })),
  {code:'1952',status:'NOT_EVALUABLE',
   reason:'UNVERIFIED_PRICE_DISCONTINUITY'}
 ];
 return {
  version:'ma75_first_forward_day_shadow_v1',
  status:'OFFLINE_SHADOW_PATTERN_REVIEW_ONLY',
  requestedSignalDate:'2026-11-02',
  historicalWarmupFirst:'2026-07-10',
  historicalWarmupLast:'2026-10-30',
  warmupSessions:75,fixedFrozenCodes:953,
  codesWithCompletePrior75:925,blockedPrior75:28,
  blockedCurrentDayAmongCompletePrior75:0,
  quarantinedPriceDiscontinuity:1,
  analyzableCodeCount:924,
  allBreakoutShadowCount:27,
  risingMa75BreakoutShadowCount:22,breakoutWithoutRisingCount:5,
  nonBreakout:897,
  allBreakoutShadowPatterns:group,shadowPatterns:group.slice(0,22),
  incompleteAndQuarantined:exclusions,
  capturedOriginalPageCount:1,
  localReceiptFirst:received,localReceiptLast:received,
  return5Percent:null,validatedForwardWinRate:null,independentForwardOutcomes:0,
  snapshotAsOfNextOpenIndependentlyAuthenticated:false,
  eligibleForProduction:false,eligibleForNotifications:false,
  eligibleForTrading:false,eligibleForAIPowerScoring:false
 };
};
const input={sourceSha256:sha,historySha256:hist,recordedAt:received};
const day=d=>new Date(d).toISOString().slice(0,10);
const days=[
 ...Array.from({length:47},(_,i)=>day(Date.parse('2026-05-01T00:00:00Z')+i*86400000)),
 ...Array.from({length:74},(_,i)=>day(Date.parse('2026-07-10T00:00:00Z')+i*86400000)),
 '2026-10-30'
];
const names=[
 ...days.map(d=>d+'-jquants-daily.json'),
 'ma75-forward-2026-11-02-jquants-daily.json'
];
function mockIo(){
 let stored=null,writes=0,raw='original-forward-bytes';
 const read=(path,enc)=>{
  if(String(path).endsWith('cohort-freeze.json')){
   if(stored===null)throw Object.assign(new Error('missing'),{code:'ENOENT'});
   return stored;
  }
  if(String(path).includes('ma75-forward-2026-11-02-jquants-daily.json'))
   return raw;
  return 'archived-original:'+String(path);
 };
 const fileInfo=path=>{
  if(String(path).endsWith('research-private'))
   return {isDirectory:()=>true,isSymbolicLink:()=>false};
  if(stored===null)throw Object.assign(new Error('missing'),{code:'ENOENT'});
  return {isFile:()=>true,isSymbolicLink:()=>false};
 };
 const write=(path,content,opts)=>{
  assert.equal(opts.flag,'wx');
  assert.equal(opts.mode,0o600);
  assert.equal(stored,null);
  stored=content;writes++;
 };
 return {
  io:{now:()=>new Date('2026-11-02T10:00:00Z'),
   read,list:()=>names,fileInfo,write,review:report},
  stats:()=>({writes,stored}),tamper:()=>{raw='tampered'}
 };
}
test('frozen ledger includes all 27 breakouts and rising subset 22, with original-source hashes',()=>{
 const x=buildMa75FirstDayResearchFreeze(report(),input);
 assert.equal(x.frozenPopulation,953);
 assert.equal(x.eligibleWarmupCount,925);
 assert.equal(x.excludedCount,29);
 assert.equal(x.breakoutsTotal,27);
 assert.equal(x.risingBreakoutCount,22);
 assert.equal(x.breakoutsAll.filter(r=>r.sma75Rising).length,22);
 assert.equal(x.originalAsOfProofIndependentlyAuthenticated,false);
 assert.equal(x.validatedWinRate,null);
 assert.equal(x.eligibleForTrading,false);
 assert.equal(x.capturedSourceSha256,sha);
 assert.equal(x.historicalWarmupSourceSha256,hist);
 assert.equal(verifyMa75FirstDayResearchFreeze(x),true);
 assert.equal(verifyMa75FirstDayResearchFreeze({
  ...x,breakoutsAll:x.breakoutsAll.slice(1)
 }),false);
 assert.equal(verifyMa75FirstDayResearchFreeze({
  ...x,eligibleForNotifications:true
 }),false);
});
test('cannot cherry-pick rising subset or silently change baseline denominator',()=>{
 const x=report();
 assert.throws(()=>buildMa75FirstDayResearchFreeze({
  ...x,shadowPatterns:x.shadowPatterns.slice(1)
 },input),/MA75_FIRST_DAY_FREEZE_MISSING_FULL_LEDGER/);
 assert.throws(()=>buildMa75FirstDayResearchFreeze({
  ...x,blockedPrior75:0
 },input),/MA75_FIRST_DAY_FREEZE_DENOMINATOR_RECONCILIATION/);
 assert.throws(()=>buildMa75FirstDayResearchFreeze({
  ...x,allBreakoutShadowPatterns:[
   {...x.allBreakoutShadowPatterns[0],sma75Rising:false},
   ...x.allBreakoutShadowPatterns.slice(1)
  ]
 },input),/MA75_FIRST_DAY_FREEZE_RISEN_SUBSET_NOT_IDENTICAL/);
});
test('offline preview writes zero files, explicit freeze writes one local immutable file, later verify is read-only',()=>{
 const m=mockIo();
 const preview=runMa75FirstDayCohortFreeze([],{...m.io});
 assert.equal(preview.status,'PREVIEW_ONLY_NO_SNAPSHOT_WRITTEN');
 assert.equal(preview.filesWritten,0);
 assert.equal(preview.allBreakouts,27);
 assert.equal(preview.risingBreakouts,22);
 assert.equal(m.stats().writes,0);
 const locked=runMa75FirstDayCohortFreeze(['--freeze'],{...m.io});
 assert.equal(locked.status,'LOCAL_RESEARCH_COHORT_FROZEN_ONCE');
 assert.equal(locked.filesWritten,1);
 assert.equal(m.stats().writes,1);
 const after=runMa75FirstDayCohortFreeze(['--verify'],{...m.io});
 assert.equal(after.status,'LOCAL_FROZEN_SHADOW_COHORT_INTEGRITY_MATCH');
 assert.equal(after.filesWritten,0);
 assert.equal(after.freezeSha256,locked.freezeSha256);
 assert.equal(m.stats().writes,1);
 assert.throws(()=>runMa75FirstDayCohortFreeze(['--freeze'],{...m.io}),
  /MA75_FIRST_DAY_COHORT_IMMUTABLE_FROZEN_COHORT_ALREADY_EXISTS/);
 m.tamper();
 assert.throws(()=>runMa75FirstDayCohortFreeze(['--verify'],{...m.io}),
  /MA75_FIRST_DAY_COHORT_SOURCE_OR_SIGNAL_COHORT_CHANGED/);
});
test('freeze fails after next TSE open, but verification of a pre-open file stays possible',()=>{
 const m=mockIo();
 const postOpen={...m.io,now:()=>new Date('2026-11-04T00:00:01Z')};
 assert.throws(()=>runMa75FirstDayCohortFreeze(['--freeze'],postOpen),
  /MA75_FIRST_DAY_COHORT_NOT_BEFORE_FIRST_NEXT_TSE_OPEN/);
 assert.equal(runMa75FirstDayCohortFreeze([],postOpen).preFollowingOpenWindow,false);
 runMa75FirstDayCohortFreeze(['--freeze'],m.io);
 assert.equal(runMa75FirstDayCohortFreeze(['--verify'],postOpen).filesWritten,0);
});
test('missing, oversized, changed or future raw-source receipt abort, no buy signal',()=>{
 assert.deepEqual(parseMa75FirstDayFreezeArgs([]),'preview');
 assert.throws(()=>parseMa75FirstDayFreezeArgs(['--freeze','--verify']),TypeError);
 const m=mockIo();
 assert.throws(()=>runMa75FirstDayCohortFreeze([],{
  ...m.io,review:()=>({...report(),localReceiptFirst:'2026-11-02T06:00:00Z'})
 }),/MA75_FIRST_DAY_COHORT_IMPOSSIBLE_CAPTURE_RECEIPT/);
 assert.throws(()=>hashMa75FirstDayOriginals(report(),{
  fileNames:names.slice(1),read:()=> 'x'
 }),/MA75_FIRST_DAY_COHORT_BASELINE_ARCHIVE_NOT_EXACT/);
 assert.throws(()=>hashMa75FirstDayOriginals(report(),{
  fileNames:names,read:()=> ''
 }),/MA75_FIRST_DAY_COHORT_ORIGINAL_CAPTURE_SIZE_INVALID/);
});
test('post-freeze dated files coexist without changing original 76-file hashes or immutable cohort',()=>{
 const m=mockIo();
 const before=runMa75FirstDayCohortFreeze([],{...m.io});
 const extraList=()=>[...names,'2026-11-04-jquants-daily.json',
  'ma75-forward-2026-11-04-jquants-daily.json'];
 const after=runMa75FirstDayCohortFreeze([],{...m.io,list:extraList});
 assert.equal(after.sourceSha256,before.sourceSha256);
 assert.equal(after.historicalWarmupSha256,before.historicalWarmupSha256);
 runMa75FirstDayCohortFreeze(['--freeze'],{...m.io});
 const verified=runMa75FirstDayCohortFreeze(['--verify'],{...m.io,list:extraList});
 assert.equal(verified.status,'LOCAL_FROZEN_SHADOW_COHORT_INTEGRITY_MATCH');
 assert.equal(verified.originalFilesHashed,76);
 assert.equal(m.stats().writes,1);
 assert.throws(()=>hashMa75FirstDayOriginals(report(),{
  fileNames:[...names.filter(n=>n!==days[3]+'-jquants-daily.json'),
   '2026-11-04-jquants-daily.json'],read:()=> 'raw'
 }),/MA75_FIRST_DAY_COHORT_BASELINE_ARCHIVE_NOT_EXACT/);
});

test('shadow research modules and CLI cannot reach APIs, deploy, trade or publish alerts',()=>{
 for(const path of [
  '../app/lib/research/ma75FirstDayResearchFreeze.mjs',
  '../scripts/research/ma75-freeze-first-forward-day.mjs'
 ]){
  const script=readFileSync(new URL(path,import.meta.url),'utf8');
  const active=script.split('\n').filter(x=>!x.trim().startsWith('*')&&!x.trim().startsWith('//')).join('\n');
  assert.doesNotMatch(active,/\bfetch\s*\(|process\.env|JQUANTS_API_KEY|vercel deploy|supabase|orderSubmit|notificationSend/);
 }
});
