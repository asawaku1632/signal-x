import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildMa75FirstDayResearchFreeze} from '../app/lib/research/ma75FirstDayResearchFreeze.mjs';
import {compareMa75FirstDayComposite}
 from '../app/lib/research/ma75FirstDayCompositeComparison.mjs';

const signalDate='2026-11-02';
const priorDates=Array.from({length:75},(_,i)=>new Date(
 Date.parse('2026-10-30T00:00:00Z')-(74-i)*86400000
).toISOString().slice(0,10));
const sample=()=>{
 const group=Array.from({length:27},(_,i)=>{
  const rise=i<22;
  return {code:String(1300+i),tradeDate:signalDate,sma75Rising:rise,
   historicalVolumeRatio:[0,1,2,22].includes(i)?2:1,
   status:'CLOSE_TIME_SHADOW_PATTERN_ONLY'};
 });
 const excluded=[
  ...Array.from({length:28},(_,i)=>({
   code:String(1000+i),status:'NOT_EVALUABLE',
   reason:'PRIOR_75_MISSING_PROVIDER_ROW'
  })),
  {code:'1952',status:'NOT_EVALUABLE',
   reason:'UNVERIFIED_PRICE_DISCONTINUITY'}
 ];
 const report={
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
  allBreakoutShadowPatterns:group,
  incompleteAndQuarantined:excluded,
  snapshotAsOfNextOpenIndependentlyAuthenticated:false,
  return5Percent:null,validatedForwardWinRate:null,
  eligibleForProduction:false,eligibleForTrading:false,
  eligibleForNotifications:false,eligibleForAIPowerScoring:false,
  independentForwardOutcomes:0
 };
 const frozen=buildMa75FirstDayResearchFreeze(report,{
  sourceSha256:'a'.repeat(64),historySha256:'b'.repeat(64),
  recordedAt:'2026-11-02T11:00:00.000Z'
 });
 const series=group.map((item,i)=>{
  const rise=i<22,matched=[0,1,2,22].includes(i);
  const bars=priorDates.map((date,j)=>{
   const close=!rise&&j===0?125:100;
   return {time:Date.parse(date+'T00:00:00Z')/1000,
    open:close,high:close+1,low:close-1,close,volume:100};
  });
  bars.push({time:Date.parse(signalDate+'T00:00:00Z')/1000,
   open:matched?105:100,high:matched?120:111,
   low:matched?100:99,close:110,volume:matched?200:100});
  return {code:item.code,bars};
 });
 return {frozen,priorDates,series};
};

test('keeps 27 control breakouts, 22 rising, wick-volume separate and rising intersection',()=>{
 const data=sample(),r=compareMa75FirstDayComposite(data.frozen,data);
 assert.equal(r.status,'SHADOW_NOT_APPROVED');
 assert.equal(r.originalFrozenPopulation,953);
 assert.equal(r.originalAllBreakouts,27);
 assert.equal(r.originalRisingBreakouts,22);
 assert.equal(r.firstDayWickAndVolumeComposite,4);
 assert.equal(r.firstDayRisingAndComposite,3);
 assert.equal(r.comparedCompleteOriginalBreakouts,27);
 assert.equal(r.perFrozenBreakout.length,27);
 assert.deepEqual(r.perFrozenBreakout.filter(x=>x.compoundMatched).map(x=>x.code),
  ['1300','1301','1302','1322']);
 assert.equal(r.perFrozenBreakout.find(x=>x.code==='1322').risingMA75,false);
 assert.equal(r.historicalPreselectedYahooCasesMixedIn,false);
 assert.equal(r.frozenCohortSha256,data.frozen.freezeSha256);
 assert.equal(r.independentlyValidatedForwardOutcomes,0);
 assert.equal(r.return1Percent,null);assert.equal(r.return3Percent,null);
 assert.equal(r.return5Percent,null);
 assert.equal(r.nextOpenPrice,null);
 assert.equal(r.eligibleForProduction,false);
 assert.equal(r.eligibleForNotifications,false);
 assert.equal(r.eligibleForAIPowerScoring,false);
 assert.equal(r.eligibleForTrading,false);
});

test('shuffled series cannot alter group membership or the frozen hash',()=>{
 const data=sample();
 const a=compareMa75FirstDayComposite(data.frozen,data);
 const b=compareMa75FirstDayComposite(data.frozen,{
  ...data,series:[...data.series].reverse()
 });
 assert.deepEqual(a,b);
 assert.equal(a.frozenCohortSha256,data.frozen.freezeSha256);
});

test('future bar or missing/duplicate frozen code refuses winners-only replacement',()=>{
 const data=sample();
 assert.throws(()=>compareMa75FirstDayComposite(data.frozen,{
  ...data,series:data.series.slice(1)
 }),/MA75_FIRST_COMPOSITE_NO_RESELECTION/);
 assert.throws(()=>compareMa75FirstDayComposite(data.frozen,{
  ...data,series:[data.series[0],...data.series.slice(0,-1)]
 }),/MA75_FIRST_COMPOSITE_NO_RESELECTION/);
 const future=data.series.map(x=>({...x,bars:[...x.bars]}));
 future[0]={...future[0],bars:[...future[0].bars,{
  ...future[0].bars.at(-1),time:Date.parse('2026-11-04T00:00:00Z')/1000
 }]};
 const r=compareMa75FirstDayComposite(data.frozen,{...data,series:future});
 assert.equal(r.notEvaluableBreakouts,1);
 assert.equal(r.originalAllBreakouts,27);
 assert.equal(r.perFrozenBreakout[0].classification,'NOT_EVALUABLE');
 assert.equal(r.return5Percent,null);
});

test('tampered price, zero baseline volume, and as-of mismatch fail closed',()=>{
 const data=sample();
 const changed=data.series.map(x=>({...x,bars:x.bars.map(b=>({...b}))}));
 changed[0].bars[75].close=90;
 assert.throws(()=>compareMa75FirstDayComposite(data.frozen,{
  ...data,series:changed
 }),/SOURCE_OR_FROZEN_SIGNAL_DISAGREEMENT/);
 const zero=data.series.map(x=>({...x,bars:x.bars.map(b=>({...b}))}));
 for(let i=55;i<75;i++)zero[0].bars[i].volume=0;
 assert.throws(()=>compareMa75FirstDayComposite(data.frozen,{
  ...data,series:zero
 }),/SOURCE_OR_FROZEN_SIGNAL_DISAGREEMENT/);
});

test('stricter OHLC quality quarantines a legitimate frozen baseline rather than throwing',()=>{
 const base=sample();
 const flat=base.series.map(x=>({...x,bars:x.bars.map(b=>({...b}))}));
 flat[0].bars[75]={...flat[0].bars[75],
  open:110,high:110,low:110,close:110};
 const out=compareMa75FirstDayComposite(base.frozen,{...base,series:flat});
 assert.equal(out.originalAllBreakouts,27);
 assert.equal(out.originalRisingBreakouts,22);
 assert.equal(out.notEvaluableBreakouts,1);
 assert.equal(out.comparedCompleteOriginalBreakouts,26);
 assert.equal(out.strictQualityQuarantinedBreakouts,1);
 assert.equal(out.perFrozenBreakout[0].classification,'NOT_EVALUABLE');
 assert.equal(out.perFrozenBreakout[0].reason,'STRICT_FILTER_INVALID_OHLCV_OR_ZERO_RANGE');
 assert.equal(out.firstDayWickAndVolumeComposite,3);
 assert.equal(out.return5Percent,null);
 assert.equal(out.eligibleForNotifications,false);
});
test('large opening gap hidden by a normal close quarantines strict-composite only',()=>{
 const base=sample();
 const gap=base.series.map(x=>({...x,bars:x.bars.map(b=>({...b}))}));
 gap[1].bars[75]={...gap[1].bars[75],
  open:161,high:180,low:99,close:110};
 const result=compareMa75FirstDayComposite(base.frozen,{...base,series:gap});
 assert.equal(result.notEvaluableBreakouts,1);
 assert.equal(result.originalAllBreakouts,27);
 assert.equal(result.perFrozenBreakout[1].reason,'STRICT_FILTER_QUARANTINED_PRICE_GAP');
 assert.equal(result.perFrozenBreakout.filter(x=>x.compoundMatched===null).length,1);
 assert.equal(result.firstDayWickAndVolumeComposite,3);
 assert.equal(result.independentlyValidatedForwardOutcomes,0);
});
test('frozen null volume baseline is excluded from compound subgroup, not retroactively fixed',()=>{
 const base=sample();
 const source=base.series.map(x=>({...x,bars:x.bars.map(b=>({...b}))}));
 source[0].bars[60].volume=0;
 const e=base.frozen;
 const report={
  version:'ma75_first_forward_day_shadow_v1',
  status:'OFFLINE_SHADOW_PATTERN_REVIEW_ONLY',
  requestedSignalDate:signalDate,historicalWarmupLast:'2026-10-30',
  warmupSessions:75,fixedFrozenCodes:953,
  codesWithCompletePrior75:925,blockedPrior75:28,
  blockedCurrentDayAmongCompletePrior75:0,quarantinedPriceDiscontinuity:1,
  analyzableCodeCount:924,nonBreakout:897,
  allBreakoutShadowCount:27,risingMa75BreakoutShadowCount:22,
  breakoutWithoutRisingCount:5,
  allBreakoutShadowPatterns:e.breakoutsAll.map(x=>({
   ...x,historicalVolumeRatio:x.code==='1300'?null:x.historicalVolumeRatio,
   status:'CLOSE_TIME_SHADOW_PATTERN_ONLY'
  })),
  incompleteAndQuarantined:e.exclusions,
  snapshotAsOfNextOpenIndependentlyAuthenticated:false,
  return5Percent:null,validatedForwardWinRate:null,
  eligibleForProduction:false,eligibleForTrading:false,
  eligibleForNotifications:false,eligibleForAIPowerScoring:false,
  independentForwardOutcomes:0
 };
 report.shadowPatterns=report.allBreakoutShadowPatterns.filter(x=>x.sma75Rising);
 const refrozen=buildMa75FirstDayResearchFreeze(report,{
  sourceSha256:e.capturedSourceSha256,
  historySha256:e.historicalWarmupSourceSha256,
  recordedAt:e.createdAt
 });
 const r=compareMa75FirstDayComposite(refrozen,{...base,series:source});
 assert.equal(r.originalAllBreakouts,27);
 assert.equal(r.firstDayWickAndVolumeComposite,3);
 assert.equal(r.notEvaluableBreakouts,1);
 assert.equal(r.perFrozenBreakout[0].reason,'STRICT_FILTER_FROZEN_VOLUME_RATIO_UNAVAILABLE');
 assert.equal(r.eligibleForProduction,false);
});

test('different freeze file and invalid session lineage do not classify signals',()=>{
 const data=sample();
 assert.throws(()=>compareMa75FirstDayComposite({
  ...data.frozen,breakoutsAll:data.frozen.breakoutsAll.slice(1)
 },data),/INVALID_IMMUTABLE_COHORT/);
 assert.throws(()=>compareMa75FirstDayComposite(data.frozen,{
  ...data,priorDates:[...data.priorDates.slice(1),signalDate]
 }),/INVALID_IMMUTABLE_COHORT/);
});

test('the cross-sample comparison cannot fetch or write or authorize a trade',()=>{
 const src=readFileSync(new URL(
  '../app/lib/research/ma75FirstDayCompositeComparison.mjs',import.meta.url),'utf8');
 const lines=src.split('\n').filter(x=>!x.trimStart().startsWith('*')&&!x.trimStart().startsWith('//')).join('\n');
 assert.doesNotMatch(lines,/\bfetch\s*\(|readFileSync|writeFileSync|process\.env|notificationSend|tradeOrder|vercel/);
 assert.match(lines,/status:'SHADOW_NOT_APPROVED'/);
 assert.match(lines,/eligibleForProduction:false/);
});
