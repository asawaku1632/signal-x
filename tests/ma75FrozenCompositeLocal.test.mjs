import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildMa75FirstDayResearchFreeze} from
 '../app/lib/research/ma75FirstDayResearchFreeze.mjs';
import {runMa75FrozenCompositeLocal,PINNED_FIRST_FORWARD_COHORT_SHA256} from
 '../scripts/research/ma75-compare-frozen-composite-local.mjs';

const priorDates=[
 ...Array.from({length:74},(_,i)=>new Date(
  Date.parse('2026-07-10T00:00:00Z')+i*86400000
 ).toISOString().slice(0,10)),
 '2026-10-30'
];
const archiveDates=[
 ...Array.from({length:47},(_,i)=>new Date(
  Date.parse('2026-05-01T00:00:00Z')+i*86400000
 ).toISOString().slice(0,10)),
 ...priorDates
];
const signalDate='2026-11-02';
const frozenFixture=()=>{
 const group=Array.from({length:27},(_,i)=>({
  code:String(1300+i),tradeDate:signalDate,
  sma75Rising:i<22,status:'CLOSE_TIME_SHADOW_PATTERN_ONLY',
  historicalVolumeRatio:[0,1,2,22].includes(i)?2:1
 }));
 const excluded=[
  ...Array.from({length:28},(_,i)=>({
   code:String(1000+i),status:'NOT_EVALUABLE',
   reason:'PRIOR_75_MISSING_PROVIDER_ROW'
  })),
  {code:'1952',status:'NOT_EVALUABLE',reason:'UNVERIFIED_PRICE_DISCONTINUITY'}
 ];
 return buildMa75FirstDayResearchFreeze({
  version:'ma75_first_forward_day_shadow_v1',
  status:'OFFLINE_SHADOW_PATTERN_REVIEW_ONLY',
  requestedSignalDate:signalDate,historicalWarmupLast:'2026-10-30',
  warmupSessions:75,fixedFrozenCodes:953,
  codesWithCompletePrior75:925,blockedPrior75:28,
  blockedCurrentDayAmongCompletePrior75:0,
  quarantinedPriceDiscontinuity:1,
  analyzableCodeCount:924,nonBreakout:897,
  allBreakoutShadowCount:27,risingMa75BreakoutShadowCount:22,
  breakoutWithoutRisingCount:5,
  shadowPatterns:group.filter(x=>x.sma75Rising),
  allBreakoutShadowPatterns:group,incompleteAndQuarantined:excluded,
  snapshotAsOfNextOpenIndependentlyAuthenticated:false,
  return5Percent:null,validatedForwardWinRate:null,
  eligibleForProduction:false,eligibleForNotifications:false,
  eligibleForTrading:false,eligibleForAIPowerScoring:false,
  independentForwardOutcomes:0
 },{
  sourceSha256:'a'.repeat(64),historySha256:'b'.repeat(64),
  recordedAt:'2026-11-02T11:00:00.000Z'
 });
};
const options=()=>{
 const frozen=frozenFixture();
 const group=frozen.breakoutsAll;
 return {
  expectedCohortSha256:frozen.freezeSha256,
  fileInfo:path=>String(path).endsWith('research-private')?
   {isDirectory:()=>true,isSymbolicLink:()=>false}:
   {isFile:()=>true,isSymbolicLink:()=>false,size:5000},
  read:path=>String(path).includes('cohort-freeze.json')?
   JSON.stringify(frozen):JSON.stringify({
    populationSize:953,firstEligibleSignalDate:signalDate
   }),
  list:()=>[
   ...archiveDates.map(d=>d+'-jquants-daily.json'),
   'ma75-forward-2026-11-02-jquants-daily.json'
  ],
  verifyOriginals:()=>({
   status:'LOCAL_FROZEN_SHADOW_COHORT_INTEGRITY_MATCH',
   freezeSha256:frozen.freezeSha256,originalFilesHashed:76,
   allBreakouts:27,risingBreakouts:22
  }),
  loadSource:path=>({date:/(20\d\d-\d\d-\d\d)-jquants-daily/.exec(path)[1]}),
  projectDay:(freeze,date,saved)=>({
   audit:{rows:group.map((entry,i)=>{
    const isSignal=date===signalDate;
    const oldest=date===priorDates[0];
    const close=isSignal?110:oldest&&i>=22?125:100;
    const special=isSignal&&[0,1,2,22].includes(i);
    return {code:entry.code,status:'DAILY_BAR',bar:{
     open:isSignal?(special?105:100):close,
     high:isSignal?(special?120:111):close+1,
     low:isSignal?(special?100:99):close-1,
     close,volume:special?200:100
    }};
   })}
  })
 };
};

test('local read-only comparison keeps 27/22 and verifies source lineage before classifying',()=>{
 const opts=options();
 let verified=0,projected=0;
 const verify=opts.verifyOriginals,project=opts.projectDay;
 opts.verifyOriginals=(...args)=>{verified++;assert.deepEqual(args[0],['--verify']);return verify()};
 opts.projectDay=(...args)=>{projected++;return project(...args)};
 const r=runMa75FrozenCompositeLocal(opts);
 assert.equal(verified,1);
 assert.equal(projected,76);
 assert.equal(r.originalAllBreakouts,27);
 assert.equal(r.originalRisingBreakouts,22);
 assert.equal(r.firstDayWickAndVolumeComposite,4);
 assert.equal(r.firstDayRisingAndComposite,3);
 assert.equal(r.ownerLocalOriginalFilesVerified,76);
 assert.equal(r.sourceStructuralReconciliationPassed,true);
 assert.equal(r.networkRequests,0);
 assert.equal(r.filesWritten,0);
 assert.equal(r.eligibleForProduction,false);
 assert.equal(r.hypotheticalOutcomeStatus,'NOT_YET_OBSERVED');
 assert.equal(r.return5Percent,null);
});
test('read-only wrapper refuses mismatched 27-signal freeze digest and tampered historical sources',()=>{
 const opts=options();
 assert.equal(PINNED_FIRST_FORWARD_COHORT_SHA256,
  '1ba1aee5ac05b2c0fd114d3cabe5463bde4409b203544722cf03c04fc0a6612b');
 assert.throws(()=>runMa75FrozenCompositeLocal({
  ...opts,expectedCohortSha256:'f'.repeat(64)
 }),/MA75_COMPOSITE_LOCAL_COHORT_DOES_NOT_MATCH/);
 assert.throws(()=>runMa75FrozenCompositeLocal({
  ...opts,verifyOriginals:()=>({...opts.verifyOriginals(),originalFilesHashed:75})
 }),/MA75_COMPOSITE_LOCAL_ORIGINAL_SOURCE_FINGERPRINT_MISMATCH/);
});
test('changed OHLCV source disagrees with immutable frozen population, never reselects',()=>{
 const opts=options(),original=opts.projectDay;
 opts.projectDay=(freeze,date,saved)=>{
  const x=original(freeze,date,saved);
  if(date===signalDate)x.audit.rows[0].bar.close=90;
  return x;
 };
 assert.throws(()=>runMa75FrozenCompositeLocal(opts),
  /MA75_FIRST_COMPOSITE_SOURCE_OR_FROZEN_SIGNAL_DISAGREEMENT/);
});
test('cannot follow a symlink, and cannot fetch, overwrite or publish a live notification',()=>{
 const opts=options();
 assert.throws(()=>runMa75FrozenCompositeLocal({
  ...opts,fileInfo:path=>String(path).endsWith('research-private')?
   {isDirectory:()=>true,isSymbolicLink:()=>true}:
   opts.fileInfo(path)
 }),/MA75_COMPOSITE_LOCAL_PRIVATE_DIRECTORY_NOT_REAL/);
 const source=readFileSync(new URL(
  '../scripts/research/ma75-compare-frozen-composite-local.mjs',import.meta.url),'utf8');
 const active=source.split('\n').filter(x=>!x.trimStart().startsWith('*')&&!x.trimStart().startsWith('//')).join('\n');
 assert.doesNotMatch(active,/\bfetch\s*\(|writeFileSync|process\.env|JQUANTS_API_KEY|broker|vercel deploy|notificationSend/);
 assert.match(active,/process\.argv\.length!==2/);
 assert.match(active,/PINNED_FIRST_FORWARD_COHORT_SHA256/);
 assert.match(active,/UNCLASSIFIED_LOCAL_INTEGRITY_ERROR/);
 assert.match(active,/\^\[A-Z\]\[A-Z0-9_\]/);
 assert.doesNotMatch(active,/console\.error\(err\)|process\.stderr\.write\(err\.?stack/);
});
