import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reviewMa75FirstForwardDay} from '../app/lib/research/ma75FirstForwardDayShadow.mjs';

const freeze=()=>({
 schemaVersion:'ma75-forward-universe-candidate-freeze-v1',
 frozenAt:'2026-10-31T13:43:02.737Z',
 firstEligibleSignalDate:'2026-11-02',
 populationSize:2,codes:['1301','186A'],
 selectionSQL:"SELECT DISTINCT code FROM public.daily_stock_results WHERE date = '2026-10-30'",
 historicalSelectionBias:'Selected from application data after the prior historical period was completed.',
 sourceChecks:{providerRights:'UNVERIFIED',barCaptureTimestamps:'UNVERIFIED',
  splitAdjustments:'UNVERIFIED',officialTradingCalendar:'UNVERIFIED',
  liquidityCoverage:'UNVERIFIED'},
 automaticCollectionEnabled:false,liveTradingEligible:false,
 notificationEligible:false,independentlyValidatedForwardReturns:0
});
const priorDates=Array.from({length:75},(_,i)=>new Date(
 Date.parse('2026-10-30T00:00:00Z')-(74-i)*86400000
).toISOString().slice(0,10));
const currentDate='2026-11-02';
const makeProject=(date,values={},statuses={})=>({
 date,completeProviderPagination:true,audit:{failures:[],rows:['1301','186A'].map(code=>{
  const status=statuses[code]??'DAILY_BAR';
  const close=values[code]??100;
  return {tradeDate:date,code,status,bar:status==='DAILY_BAR'?{
   tradeDate:date,code,open:close,high:close+1,low:close-1,
   close,volume:1000
  }:null};
 })}
});
const input=()=>({
 priorDates:[...priorDates],
 priorProjections:priorDates.map(date=>makeProject(date)),
 currentDate,currentProjection:makeProject(currentDate,{'1301':110,'186A':95})
});

test('first forward observation uses only preceding 75 days and one captured close',()=>{
 const result=reviewMa75FirstForwardDay(freeze(),input());
 assert.equal(result.status,'OFFLINE_SHADOW_PATTERN_REVIEW_ONLY');
 assert.equal(result.fixedFrozenCodes,2);
 assert.equal(result.codesWithCompletePrior75,2);
 assert.equal(result.analyzableCodeCount,2);
 assert.equal(result.allBreakoutShadowCount,1);
 assert.equal(result.risingMa75BreakoutShadowCount,1);
 assert.equal(result.allBreakoutShadowPatterns.length,1);
 assert.equal(result.allBreakoutShadowPatterns[0].code,'1301');
 assert.equal(result.allBreakoutGroupsIncludeUnprofitableCandidates,true);
 assert.equal(result.nonBreakout,1);
 assert.deepEqual(result.shadowPatterns.map(r=>r.code),['1301']);
 assert.equal(result.shadowPatterns[0].sma75Rising,true);
 assert.equal(result.return5Percent,null);
 assert.equal(result.validatedForwardWinRate,null);
 assert.equal(result.independentForwardOutcomes,0);
 assert.equal(result.snapshotAsOfNextOpenIndependentlyAuthenticated,false);
 assert.equal(result.eligibleForProduction,false);
 assert.equal(result.eligibleForNotifications,false);
 assert.equal(result.eligibleForTrading,false);
});

test('missing warmup bars and current corporate actions stay excluded, never silently turn into winners',()=>{
 const x=input();
 x.priorProjections[0]=makeProject(priorDates[0],{}, {'1301':'CORPORATE_ACTION_REVIEW'});
 x.currentProjection=makeProject(currentDate,{}, {'186A':'NO_TRADE'});
 const result=reviewMa75FirstForwardDay(freeze(),x);
 assert.equal(result.codesWithCompletePrior75,1);
 assert.equal(result.blockedPrior75,1);
 assert.equal(result.blockedCurrentDayAmongCompletePrior75,1);
 assert.equal(result.analyzableCodeCount,0);
 assert.equal(result.allBreakoutShadowCount,0);
 assert.equal(result.reasonCounts.PRIOR_75_CORPORATE_ACTION_REVIEW,1);
 assert.equal(result.reasonCounts.CURRENT_NO_TRADE,1);
});

test('a breakout whose SMA75 is falling stays outside rising candidate definition',()=>{
 const x=input();
 x.priorProjections[0]=makeProject(priorDates[0],{'1301':125,'186A':100});
 const result=reviewMa75FirstForwardDay(freeze(),x);
 assert.equal(result.allBreakoutShadowCount,1);
 assert.equal(result.breakoutWithoutRisingCount,1);
 assert.equal(result.risingMa75BreakoutShadowCount,0);
});

test('suspicious close discontinuity is quarantined before signal classification',()=>{
 const x=input();
 x.currentProjection=makeProject(currentDate,{'1301':190,'186A':100});
 const r=reviewMa75FirstForwardDay(freeze(),x);
 assert.equal(r.quarantinedPriceDiscontinuity,1);
 assert.equal(r.reasonCounts.UNVERIFIED_PRICE_DISCONTINUITY,1);
 assert.equal(r.allBreakoutShadowCount,0);
});

test('cannot include future sessions, wrong frozen date or silently omit a stock',()=>{
 const x=input();
 assert.throws(()=>reviewMa75FirstForwardDay(freeze(),{
  ...x,currentDate:'2026-11-04'
 }),/MA75_FIRST_FORWARD_REQUIRE_FIRST_FROZEN_DATE/);
 assert.throws(()=>reviewMa75FirstForwardDay(freeze(),{
  ...x,priorDates:[...x.priorDates.slice(1),'2026-11-04']
 }),/MA75_FIRST_FORWARD_REQUIRE_FIRST_FROZEN_DATE/);
 assert.throws(()=>reviewMa75FirstForwardDay(freeze(),{
  ...x,currentProjection:{...x.currentProjection,
   audit:{...x.currentProjection.audit,rows:x.currentProjection.audit.rows.slice(0,1)}}
 }),/MA75_FIRST_FORWARD_INVALID_PROJECTED_DAY/);
});
test('pure review has no I/O, orders, notifications or API access',()=>{
 const src=readFileSync(new URL(
 '../app/lib/research/ma75FirstForwardDayShadow.mjs',import.meta.url),'utf8');
 const active=src.split('\n').filter(x=>!x.trimStart().startsWith('*')&&!x.trimStart().startsWith('//')).join('\n');
 assert.doesNotMatch(active,/\bfetch\s*\(|writeFileSync|readFileSync|process\.env|JQUANTS_API_KEY|tradeOrder|notificationSend/);
 assert.match(src,/snapshotAsOfNextOpenIndependentlyAuthenticated:false/);
 assert.match(src,/independentForwardOutcomes:0/);
});
