import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildMa75FirstDayResearchFreeze} from
 '../app/lib/research/ma75FirstDayResearchFreeze.mjs';
import {evaluateMa75FirstSessionForward} from
 '../app/lib/research/ma75FirstSessionForwardOutcome.mjs';

const groupCodes=[
 ...Array.from({length:24},(_,i)=>String(1400+i)),
 '1878','7172','9832'
].sort();
const compound=new Set(['1878','7172','9832']);
const nonRising=new Set(['1419','1420','1421','1422','1423']);
const synthetic=()=>{
 const breakouts=groupCodes.map(code=>({
  code,tradeDate:'2026-11-02',
  sma75Rising:!nonRising.has(code),
  historicalVolumeRatio:compound.has(code)?2:1,
  status:'CLOSE_TIME_SHADOW_PATTERN_ONLY'
 }));
 const exclusions=[
  ...Array.from({length:28},(_,i)=>({
   code:String(1000+i),status:'NOT_EVALUABLE',
   reason:'PRIOR_75_MISSING_PROVIDER_ROW'
  })),
  {code:'1952',status:'NOT_EVALUABLE',
   reason:'UNVERIFIED_PRICE_DISCONTINUITY'}
 ];
 const frozen=buildMa75FirstDayResearchFreeze({
  version:'ma75_first_forward_day_shadow_v1',
  status:'OFFLINE_SHADOW_PATTERN_REVIEW_ONLY',
  requestedSignalDate:'2026-11-02',historicalWarmupLast:'2026-10-30',
  warmupSessions:75,fixedFrozenCodes:953,
  codesWithCompletePrior75:925,blockedPrior75:28,
  blockedCurrentDayAmongCompletePrior75:0,quarantinedPriceDiscontinuity:1,
  analyzableCodeCount:924,nonBreakout:897,
  allBreakoutShadowCount:27,risingMa75BreakoutShadowCount:22,
  breakoutWithoutRisingCount:5,
  allBreakoutShadowPatterns:breakouts,
  shadowPatterns:breakouts.filter(x=>x.sma75Rising),
  incompleteAndQuarantined:exclusions,
  snapshotAsOfNextOpenIndependentlyAuthenticated:false,
  return5Percent:null,validatedForwardWinRate:null,
  independentForwardOutcomes:0,
  eligibleForProduction:false,eligibleForTrading:false,
  eligibleForNotifications:false,eligibleForAIPowerScoring:false
 },{sourceSha256:'a'.repeat(64),historySha256:'b'.repeat(64),
  recordedAt:'2026-11-02T11:00:00.000Z'});
 const comparison={
  status:'SHADOW_NOT_APPROVED',
  frozenCohortSha256:frozen.freezeSha256,
  originalAllBreakouts:27,originalRisingBreakouts:22,
  firstDayWickAndVolumeComposite:3,firstDayRisingAndComposite:3,
  notEvaluableBreakouts:0,
  perFrozenBreakout:breakouts.map(b=>({
   code:b.code,risingMA75:b.sma75Rising,
   compoundMatched:compound.has(b.code),
   classification:compound.has(b.code)?
    'COMPOUND_SHADOW_MATCH':'BASELINE_BREAKOUT_ONLY'
  }))
 };
 const codes=[...groupCodes,
  ...Array.from({length:926},(_,i)=>String(2000+i))];
 const projection={
  date:'2026-11-04',completeProviderPagination:true,
  originalAllListedRows:4445,projectedFrozenRows:953,
  audit:{failures:[],rows:codes.map(code=>({
   code,tradeDate:'2026-11-04',
   status:'DAILY_BAR',bar:{
    tradeDate:'2026-11-04',code,open:100,high:110,low:95,
    close:code==='1878'?90:105,volume:1000
   }
  }))}
 };
 return {frozen,comparison,projection};
};
const run=(data,projection=data.projection)=>evaluateMa75FirstSessionForward(
 data.frozen,data.comparison,{
  projection,outcomeDay:'2026-11-04',
  sourceReceiptAt:'2026-11-04T08:00:00Z',
  asOf:'2026-11-04T11:00:00Z'
 });

test('all original 27, rising 22, compound 3 remain intact after one-day outcome',()=>{
 const data=synthetic(),r=run(data);
 assert.equal(r.status,'SHADOW_NOT_APPROVED');
 assert.equal(r.originalCodesRetained,27);
 assert.equal(r.risingCodesRetained,22);
 assert.equal(r.compoundCodesRetained,3);
 assert.equal(r.groups.allBreakouts.records,27);
 assert.equal(r.groups.risingBreakouts.records,22);
 assert.equal(r.groups.compoundBreakouts.records,3);
 assert.equal(r.groups.allBreakouts.measured,27);
 assert.equal(r.groups.compoundBreakouts.measured,3);
 assert.equal(r.groups.compoundBreakouts.positiveRatePercent,66.67);
 assert.equal(r.byFrozenCode.find(x=>x.code==='1878').return1Percent<0,true);
 assert.equal(r.byFrozenCode.find(x=>x.code==='1878').profitYen100<0,true);
 assert.equal(r.byFrozenCode.find(x=>x.code==='7172').profitYen100>0,true);
 assert.equal(r.return3Percent,null);
 assert.equal(r.return5Percent,null);
 assert.equal(r.independentValidatedForwardOutcomes,0);
 assert.equal(r.tradingEligible,false);
 assert.equal(r.notificationsEligible,false);
 assert.equal(r.productionEligible,false);
 assert.equal(r.aiPowerEligible,false);
 assert.equal(r.filesWritten,0);
 assert.equal(r.networkRequests,0);
});
test('no new original Nov4 date is a PENDING observation, not a zero-return or lost baseline',()=>{
 const data=synthetic(),r=run(data,null);
 assert.equal(r.originalCodesRetained,27);
 assert.equal(r.firstDayObservedSource,false);
 assert.equal(r.groups.allBreakouts.pending,27);
 assert.equal(r.groups.compoundBreakouts.pending,3);
 assert.equal(r.groups.allBreakouts.measured,0);
 assert.equal(r.groups.allBreakouts.meanReturnPercent,null);
 assert.equal(r.groups.compoundBreakouts.positiveRatePercent,null);
 assert.ok(r.byFrozenCode.every(x=>x.return1Percent===null));
});
test('provider corporate action, no trade and flat bar exclude from return denominators',()=>{
 const d=synthetic();
 const rows=d.projection.audit.rows;
 rows.find(x=>x.code==='1878').status='CORPORATE_ACTION_REVIEW';
 rows.find(x=>x.code==='1878').bar=null;
 rows.find(x=>x.code==='7172').status='NO_TRADE';
 rows.find(x=>x.code==='7172').bar=null;
 const flat=rows.find(x=>x.code==='9832');
 flat.bar.high=flat.bar.low=flat.bar.open=flat.bar.close=100;
 const r=run(d);
 assert.equal(r.originalCodesRetained,27);
 assert.equal(r.compoundCodesRetained,3);
 assert.equal(r.groups.compoundBreakouts.measured,0);
 assert.equal(r.groups.compoundBreakouts.pending,1);
 assert.equal(r.groups.compoundBreakouts.quarantined,2);
 assert.equal(r.byFrozenCode.find(x=>x.code==='1878').status,
  'QUARANTINED_CORPORATE_ACTION_REVIEW');
 assert.equal(r.byFrozenCode.find(x=>x.code==='7172').status,'PENDING_NO_TRADE');
 assert.equal(r.byFrozenCode.find(x=>x.code==='9832').status,
  'QUARANTINED_FLAT_BAR_FILL_UNVERIFIED');
 assert.equal(r.groups.compoundBreakouts.meanReturnPercent,null);
});
test('future data, wrong receipt, duplicate provider row, and changed frozen membership fail closed',()=>{
 const d=synthetic();
 assert.throws(()=>run(d,{
  ...d.projection,date:'2026-11-05'
 }),/MA75_FIRST_SESSION_INVALID_ALL_LISTED_DATE_PROJECTION/);
 assert.throws(()=>evaluateMa75FirstSessionForward(d.frozen,d.comparison,{
  projection:d.projection,sourceReceiptAt:'2026-11-04T06:00:00Z',
  asOf:'2026-11-04T11:00:00Z'
 }),/MA75_FIRST_SESSION_UNVERIFIED_OR_IMPOSSIBLE_RECEIPT_TIME/);
 const duplicated={...d.projection,audit:{...d.projection.audit,
  rows:[...d.projection.audit.rows.slice(0,-1),d.projection.audit.rows[0]]}};
 assert.throws(()=>run(d,duplicated),/MA75_FIRST_SESSION_DUPLICATED_OR_WRONG_DATE_FROZEN_ROW/);
 const wrong={...d.comparison,perFrozenBreakout:
  d.comparison.perFrozenBreakout.slice(1)};
 assert.throws(()=>evaluateMa75FirstSessionForward(d.frozen,wrong),
  /MA75_FIRST_SESSION_INVALID_PINNED_FIRST_DATE_COMPARISON/);
 const renamed={...d.comparison,perFrozenBreakout:
  d.comparison.perFrozenBreakout.map((x,i)=>i===0?
   {...x,code:'9999'}:x)};
 assert.throws(()=>evaluateMa75FirstSessionForward(d.frozen,renamed),
  /MA75_FIRST_SESSION_ORIGINAL_BREAKOUTS_RESELECTED_OR_CHANGED/);
});
test('one-day audit never asserts actual fills, profit edge or future three/five-day outcomes',()=>{
 const d=synthetic(),r=run(d);
 assert.equal(r.byFrozenCode[0].actualFillVerified,false);
 assert.equal(r.byFrozenCode[0].entryOpenAvailableBeforeOpenIndependentlyVerified,false);
 assert.equal(r.sourceTimingIndependentlyVerified,false);
 assert.equal(r.marketCalendarIndependentlyVerified,false);
 assert.equal(r.independentlyValidatedWinRate,null);
 assert.equal(r.byFrozenCode.filter(x=>x.compoundWickVolume).length,3);
 assert.equal(r.groups.risingBreakouts.records,22);
 assert.equal(r.originalCohortChanged,false);
 const code=readFileSync(new URL(
  '../app/lib/research/ma75FirstSessionForwardOutcome.mjs',import.meta.url),'utf8');
 const active=code.split('\n').filter(x=>!x.trimStart().startsWith('*')&&!x.trimStart().startsWith('//')).join('\n');
 assert.doesNotMatch(active,/\bfetch\s*\(|readFileSync|writeFileSync|process\.env|JQUANTS_API_KEY|broker|notificationSend/);
});
