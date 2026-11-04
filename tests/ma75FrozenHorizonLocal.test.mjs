import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildMa75FirstDayResearchFreeze}
 from '../app/lib/research/ma75FirstDayResearchFreeze.mjs';
import {runMa75Frozen135Local} from
 '../scripts/research/ma75-135-horizons-local.mjs';
import {MA75_FROZEN_SESSIONS}
 from '../app/lib/research/ma75FrozenForwardHorizons.mjs';
const DAYS=MA75_FROZEN_SESSIONS;
const codes=[...Array.from({length:24},(_,i)=>String(1400+i)),
 '1878','7172','9832'].sort();
const compound=new Set(['1878','7172','9832']);
const notRising=new Set(['1419','1420','1421','1422','1423']);
const fake=()=>{
 const group=codes.map(code=>({
  code,tradeDate:'2026-11-02',sma75Rising:!notRising.has(code),
  historicalVolumeRatio:2,status:'CLOSE_TIME_SHADOW_PATTERN_ONLY'
 }));
 const excluded=[...Array.from({length:28},(_,i)=>({
  code:String(1000+i),status:'NOT_EVALUABLE',
  reason:'PRIOR_75_MISSING_PROVIDER_ROW'
 })),{code:'1952',status:'NOT_EVALUABLE',
  reason:'UNVERIFIED_PRICE_DISCONTINUITY'}];
 const frozen=buildMa75FirstDayResearchFreeze({
  version:'ma75_first_forward_day_shadow_v1',
  status:'OFFLINE_SHADOW_PATTERN_REVIEW_ONLY',
  requestedSignalDate:'2026-11-02',historicalWarmupLast:'2026-10-30',
  warmupSessions:75,fixedFrozenCodes:953,codesWithCompletePrior75:925,
  blockedPrior75:28,blockedCurrentDayAmongCompletePrior75:0,
  quarantinedPriceDiscontinuity:1,analyzableCodeCount:924,
  nonBreakout:897,allBreakoutShadowCount:27,
  risingMa75BreakoutShadowCount:22,breakoutWithoutRisingCount:5,
  allBreakoutShadowPatterns:group,
  shadowPatterns:group.filter(x=>x.sma75Rising),
  incompleteAndQuarantined:excluded,
  snapshotAsOfNextOpenIndependentlyAuthenticated:false,
  return5Percent:null,validatedForwardWinRate:null,
  independentForwardOutcomes:0,eligibleForProduction:false,
  eligibleForTrading:false,eligibleForNotifications:false,
  eligibleForAIPowerScoring:false
 },{
  sourceSha256:'a'.repeat(64),historySha256:'b'.repeat(64),
  recordedAt:'2026-11-02T11:00:00.000Z'
 });
 const first={
  version:'ma75_first_session_forward_observation_v1',
  status:'SHADOW_NOT_APPROVED',frozenCohortSha256:frozen.freezeSha256,
  originalCodesRetained:27,risingCodesRetained:22,compoundCodesRetained:3,
  firstDayObservedSource:true,independentValidatedForwardOutcomes:0,
  return3Percent:null,return5Percent:null,
  productionEligible:false,notificationsEligible:false,
  byFrozenCode:codes.map(code=>({
   code,risingMA75:!notRising.has(code),
   compoundWickVolume:compound.has(code),
   status:'HYPOTHETICAL_FIRST_SESSION_ONLY',
   return1Percent:4.7902,profitYen100:479.5,
   modeledEntryCostYen100:10010,
   modeledBudgetLots:{eligible:true,minLots:10,maxLots:49}
  }))
 };
 const allCodes=[...codes,...Array.from({length:926},(_,i)=>String(2000+i))];
 const daily=date=>({
  date,completeProviderPagination:true,
  originalAllListedRows:4450,projectedFrozenRows:953,
  audit:{failures:[],rows:allCodes.map(code=>({
   code,tradeDate:date,status:'DAILY_BAR',
   bar:{tradeDate:date,code,open:date===DAYS[0]?100:105,
    high:110,low:95,close:105,volume:1000}
  }))}
 });
 return {frozen,first,daily};
};
const mock=(f,dates=DAYS.slice(0,1))=>({
 clock:()=>new Date('2026-11-11T11:00:00Z'),
 expectedFreezeSha256:f.frozen.freezeSha256,
 fileInfo:()=>({isFile:()=>true,isSymbolicLink:()=>false,size:5000}),
 read:path=>String(path).endsWith('cohort-freeze.json')?
  JSON.stringify(f.frozen):JSON.stringify({
   populationSize:953,firstEligibleSignalDate:'2026-11-02'
  }),
 first:()=>f.first,
 readSaved:path=>{
  const date=DAYS.find(d=>String(path).includes(d));
  return dates.includes(date)?{date,pages:[{
   receivedAt:date+'T08:00:00Z',response:{data:[]}
  }]}:null;
 },
 validateSaved:(_,date)=>f.daily(date)
});
test('owner local no-network run reads Nov4 once and reports 27 measured, future 3/5 pending',()=>{
 const f=fake(),r=runMa75Frozen135Local(mock(f));
 assert.equal(r.horizons.session1.groups.allBreakouts.measured,27);
 assert.equal(r.horizons.session3.groups.allBreakouts.pending,27);
 assert.equal(r.horizons.session5.groups.compoundBreakouts.pending,3);
 assert.equal(r.inputOriginalDays.length,1);
 assert.equal(r.frozenOriginalSha256MatchesPinned,true);
 assert.equal(r.noNewJQuantsCaptureRequested,true);
 assert.equal(r.providerQueries,0);
 assert.equal(r.writtenFiles,0);
});
test('all original five days must be present to settle three/five session returns',()=>{
 const f=fake(),full=runMa75Frozen135Local(mock(f,DAYS));
 assert.equal(full.horizons.session5.groups.compoundBreakouts.measured,3);
 assert.equal(full.horizons.session3.groups.risingBreakouts.measured,22);
 assert.equal(full.perFrozenCodeHorizon.length,81);
 const partial=runMa75Frozen135Local(mock(f,[DAYS[0],DAYS[2],DAYS[4]]));
 assert.equal(partial.horizons.session3.groups.allBreakouts.pending,27);
 assert.equal(partial.horizons.session5.groups.allBreakouts.pending,27);
});
test('outcome receipt after now and changed freeze SHA always fail closed',()=>{
 const f=fake(),o=mock(f),now=()=>new Date('2026-11-04T07:40:00Z');
 assert.throws(()=>runMa75Frozen135Local({...o,clock:now}),
  /MA75_135_LOCAL_IMPOSSIBLE_ORIGINAL_SOURCE_RECEIPT/);
 assert.throws(()=>runMa75Frozen135Local({
  ...o,expectedFreezeSha256:'f'.repeat(64)
 }),/MA75_135_LOCAL_IMMUTABLE_FIRST_DAY_INVALID/);
 const changed=mock(f);
 changed.read=path=>String(path).endsWith('cohort-freeze.json')?
  JSON.stringify({...f.frozen,freezeSha256:'0'.repeat(64)}):
  o.read(path);
 assert.throws(()=>runMa75Frozen135Local(changed),
  /MA75_135_LOCAL_FROZEN_MANIFEST_CHANGED/);
});
test('local horizon runner cannot perform API calls or mutate originals',()=>{
 const code=readFileSync(new URL(
  '../scripts/research/ma75-135-horizons-local.mjs',import.meta.url),'utf8');
 const active=code.split('\n').filter(x=>!x.trim().startsWith('*')&&
  !x.trim().startsWith('//')).join('\n');
 assert.doesNotMatch(active,/\bfetch\s*\(|writeFileSync|process\.env|JQUANTS_API_KEY|broker|notificationSend|deploy/);
 assert.match(active,/MA75_135_LOCAL_NO_ARGUMENTS_ALLOWED/);
});
