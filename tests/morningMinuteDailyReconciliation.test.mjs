import test from 'node:test';
import assert from 'node:assert/strict';
import {auditMorningMinuteShadow} from '../app/lib/research/morningMinuteShadow.mjs';
import {parseMa75JQuantsDailyPages} from '../app/lib/research/ma75JQuantsDailyPages.mjs';
import {reconcileMorningMinuteDaily} from '../app/lib/research/morningMinuteDailyReconciliation.mjs';

const date='2026-10-30',code='3762';
const freeze=()=>({
 schemaVersion:'ma75-forward-universe-candidate-freeze-v1',
 frozenAt:'2026-10-31T13:43:02.737Z',
 firstEligibleSignalDate:'2026-11-02',
 populationSize:2,codes:['1301','3762'],
 selectionSQL:"SELECT DISTINCT code FROM public.daily_stock_results WHERE date = '2026-10-30'",
 historicalSelectionBias:'Application-observed symbols, not all liquid JPX-listed stocks.',
 sourceChecks:{providerRights:'UNVERIFIED',barCaptureTimestamps:'UNVERIFIED',
 splitAdjustments:'UNVERIFIED',officialTradingCalendar:'UNVERIFIED',
 liquidityCoverage:'UNVERIFIED'},
 automaticCollectionEnabled:false,liveTradingEligible:false,
 notificationEligible:false,independentlyValidatedForwardReturns:0
});
const minuteRows=()=>[
 {Date:date,Time:'09:00',Code:'37620',O:100,H:102,L:99,C:101,Vo:100,Va:10050},
 {Date:date,Time:'09:01',Code:'37620',O:101,H:103,L:100,C:102,Vo:200,Va:20300},
 {Date:date,Time:'11:30',Code:'37620',O:102,H:103,L:101,C:102,Vo:50,Va:5100},
 {Date:date,Time:'15:30',Code:'37620',O:102,H:104,L:101,C:103,Vo:150,Va:15450}
];
const dailyRows=()=>[
 {Date:date,Code:'13010',O:20,H:21,L:19,C:20,Vo:1000,AdjFactor:1,ExRT:null},
 {Date:date,Code:'37620',O:100,H:104,L:99,C:103,Vo:500,AdjFactor:1,ExRT:null}
];
const minute=(rows=minuteRows(),token=null)=>auditMorningMinuteShadow(freeze(),{
 code,date,pages:[{requestPaginationKey:null,receivedAt:'2026-11-01T08:00:00Z',
  response:{data:rows,...(token===null?{}:{pagination_key:token})}}]
});
const daily=(rows=dailyRows(),token=null)=>parseMa75JQuantsDailyPages(freeze(),{
 date,pages:[{requestPaginationKey:null,receivedAt:'2026-11-01T08:00:00Z',
  response:{data:rows,...(token===null?{}:{pagination_key:token})}}]
});
const audit=(m=minute(),d=daily())=>reconcileMorningMinuteDaily(freeze(),{
 code,date,minute:m,daily:d
});
test('actual minute parser aggregates all day; source daily parser matches O/H/L/C and volume',()=>{
 const m=minute(),r=audit(m);
 assert.equal(m.dailyObservation.open,100);
 assert.equal(m.dailyObservation.high,104);
 assert.equal(m.dailyObservation.low,99);
 assert.equal(m.dailyObservation.close,103);
 assert.equal(m.dailyObservation.volume,500);
 assert.equal(m.dailyObservation.turnover,50900);
 assert.equal(m.dailyObservation.barCount,4);
 assert.equal(m.dailyObservation.lastTradeMinute,'15:30');
 assert.equal(r.structuralOneCodeDayMatched,true);
 assert.equal(r.blocked,false);
 assert.deepEqual(r.blockers,[]);
 assert.equal(r.eligibleForNotifications,false);
 assert.equal(r.directProviderCaptureAuthenticated,false);
});
test('provider row order does not change sorted daily first open or final close',()=>{
 const rows=minuteRows().reverse(),m=minute(rows),r=audit(m);
 assert.equal(m.dailyObservation.firstTradeMinute,'09:00');
 assert.equal(m.dailyObservation.lastTradeMinute,'15:30');
 assert.equal(r.structuralOneCodeDayMatched,true);
});
test('one missing executed minute fails volume reconciliation, not silently improving win rate',()=>{
 const rows=minuteRows().filter(x=>x.Time!=='09:01');
 const r=audit(minute(rows));
 assert.equal(r.structuralOneCodeDayMatched,false);
 assert.ok(r.blockers.includes('DAILY_MINUTE_VOLUME_MISMATCH'));
 assert.ok(r.blockers.includes('DAILY_MINUTE_HIGH_MISMATCH')===false);
});
test('missing final auction bar makes day close and volume inconsistent',()=>{
 const m=minute(minuteRows().filter(x=>x.Time!=='15:30'));
 const r=audit(m);
 assert.equal(m.dailyObservation.lastTradeMinute,'11:30');
 assert.ok(r.blockers.includes('DAILY_MINUTE_CLOSE_MISMATCH'));
 assert.ok(r.blockers.includes('DAILY_MINUTE_VOLUME_MISMATCH'));
});
test('correct count but modified raw daily high or close fails source cross-check',()=>{
 for(const field of ['H','C','O','L']){
  const source=dailyRows();
  source[1][field]+=field==='L'?-1:1;
  const r=audit(minute(),daily(source));
  assert.equal(r.structuralOneCodeDayMatched,false);
  assert.ok(r.blockers.some(s=>s==='DAILY_MINUTE_'+
    ({H:'HIGH',C:'CLOSE',O:'OPEN',L:'LOW'}[field])+'_MISMATCH'));
 }
});
test('minute OHLCV can never be matched to a corporate-action reviewed daily bar',()=>{
 const source=dailyRows();
 source[1].AdjFactor=0.8;
 const d=daily(source);
 assert.equal(d.rows.find(x=>x.code===code).status,'CORPORATE_ACTION_REVIEW');
 const r=audit(minute(),d);
 assert.ok(r.blockers.includes('CORPORATE_ACTION_UNRESOLVED'));
 assert.equal(r.structuralOneCodeDayMatched,false);
});
test('no traded minutes and daily no-trade are a matched no-trade day, never a buy signal',()=>{
 const source=dailyRows();
 source[1]={Date:date,Code:'37620',O:null,H:null,L:null,C:null,Vo:null,
  AdjFactor:1,ExRT:null};
 const r=audit(minute([]),daily(source));
 assert.equal(r.matchingNoTradeSession,true);
 assert.equal(r.structuralOneCodeDayMatched,false);
 assert.equal(r.blocked,true);
 assert.equal(r.validProspectiveBuyObservations,0);
});
test('empty minute data versus valid daily volume is an explicit missing trade-history failure',()=>{
 const r=audit(minute([]));
 assert.ok(r.blockers.includes('DAILY_TRADES_BUT_NO_MINUTE_BARS'));
 assert.equal(r.structuralOneCodeDayMatched,false);
});
test('daily no-trade and nonempty minute data mismatch is not a valid no-trade session',()=>{
 const source=dailyRows();
 source[1]={Date:date,Code:'37620',O:null,H:null,L:null,C:null,Vo:null,
  AdjFactor:1,ExRT:null};
 const r=audit(minute(),daily(source));
 assert.equal(r.matchingNoTradeSession,false);
 assert.ok(r.blockers.includes('DAILY_NO_TRADE_BUT_MINUTE_TRADES_FOUND'));
});
test('truncated pagination in either source quarantines same-day reconciliation',()=>{
 const rm=audit(minute(minuteRows(),'NEXT'),daily());
 assert.ok(rm.blockers.includes('INVALID_OR_DIFFERENT_MINUTE_AUDIT'));
 assert.equal(rm.structuralOneCodeDayMatched,false);
 const rd=audit(minute(),daily(dailyRows(),'NEXT'));
 assert.ok(rd.blockers.includes('INVALID_OR_DIFFERENT_DAILY_AUDIT'));
 assert.equal(rd.structuralOneCodeDayMatched,false);
});
test('forged prior-version source or mismatched source code/date is rejected',()=>{
 const m=minute(),d=daily();
 const a=audit({...m,version:'morning_minute_shadow_v1'},d);
 assert.ok(a.blockers.includes('INVALID_OR_DIFFERENT_MINUTE_AUDIT'));
 const b=audit(m,{...d,version:'ma75_jquants_v2_offline_daily_v2'});
 assert.ok(b.blockers.includes('INVALID_OR_DIFFERENT_DAILY_AUDIT'));
 const c=audit({...m,code:'9984'},d);
 assert.ok(c.blockers.includes('INVALID_OR_DIFFERENT_MINUTE_AUDIT'));
});
test('frozen population and explicit code/day are required, never choose winner retrospectively',()=>{
 const a=minute(),b=daily();
 assert.throws(()=>reconcileMorningMinuteDaily(freeze(),{code:'9999',date,minute:a,daily:b}),TypeError);
 assert.throws(()=>reconcileMorningMinuteDaily(freeze(),{code,date:'wrong',minute:a,daily:b}),TypeError);
 const malformed=freeze();malformed.codes=['1301','1301'];
 assert.throws(()=>reconcileMorningMinuteDaily(malformed,{code,date,minute:a,daily:b}),TypeError);
});
test('same-day matching does not enable 09:05 availability, notifications, forward outcomes, or trading',()=>{
 const r=audit();
 assert.equal(r.structuralOneCodeDayMatched,true);
 assert.equal(r.actual0905AvailabilityVerified,false);
 assert.equal(r.chartCalendarAndActionsIndependentlyVerified,false);
 assert.equal(r.eligibleForProduction,false);
 assert.equal(r.eligibleForNotifications,false);
 assert.equal(r.validProspectiveBuyObservations,0);
});

test('one missing share in a 500-million-share high-volume day is still a data integrity mismatch',()=>{
 const rows=minuteRows().map(r=>({...r,Vo:r.Vo*1000000,Va:r.Va*1000000}));
 const d=dailyRows();
 d[1].Vo=500000001;
 const result=audit(minute(rows),daily(d));
 assert.equal(result.structuralOneCodeDayMatched,false);
 assert.ok(result.blockers.includes('DAILY_MINUTE_VOLUME_MISMATCH'));
 assert.equal(result.eligibleForNotifications,false);
});

test('source counts and unrecognized extra rows prevent a falsely complete code/day',()=>{
 const m=minute(),original=daily();
 const damaged=[
  {...original,counts:{...original.counts,DAILY_BAR:999}},
  {...original,rawProviderRows:0},
  {...original,readPages:0},
  {...original,unmappedRows:[{reason:'WRONG_DATE_OR_SECURITY_CLASS'}]},
  {...original,outsideFrozenCodes:['9999']},
  {...original,duplicateCodeDates:['3762:'+date]},
  {...original,structurallyUsableRawBars:1}
 ];
 for(const d of damaged){
   const r=audit(m,d);
   assert.ok(r.blockers.includes('INVALID_OR_DIFFERENT_DAILY_AUDIT'));
   assert.equal(r.structuralOneCodeDayMatched,false);
 }
});
test('unverifiable original vendor receipt time cannot count as proof of complete daily history',()=>{
 const m=minute(),d=daily();
 for(const change of [
  {firstReceivedAt:null},
  {firstReceivedAt:'2026-10-30T07:00:00Z'},
  {lastReceivedAt:'2026-10-30T06:00:00Z'},
  {lastReceivedAt:'not-a-timestamp'}
 ]){
  const r=audit(m,{...d,...change});
  assert.ok(r.blockers.includes('INVALID_OR_DIFFERENT_DAILY_AUDIT'));
  assert.equal(r.structuralOneCodeDayMatched,false);
 }
});
test('minute receipts prior to usual provider daily release must not be treated as 09:05 market proof',()=>{
 const d=daily(),m=minute();
 for(const change of [
  {firstReceivedAt:'2026-10-30T06:31:00Z'},
  {lastReceivedAt:'2026-10-30T06:40:00Z'},
  {lastReceivedAt:null}
 ]){
  const r=audit({...m,...change},d);
  assert.ok(r.blockers.includes('INVALID_OR_DIFFERENT_MINUTE_AUDIT'));
  assert.equal(r.actual0905AvailabilityVerified,false);
 }
});
test('inconsistent minute aggregate bar count and observed number of bars fail even with matching OHLCV',()=>{
 const d=daily(),m=minute();
 for(const discrepancy of [
  {barCount:m.dailyObservation.barCount+1},
  {barCount:0},
  {barCount:328}
 ]){
  const r=audit({...m,dailyObservation:{...m.dailyObservation,...discrepancy}},d);
  assert.ok(r.blockers.includes('INVALID_MINUTE_DAY_AGGREGATE'));
  assert.equal(r.structuralOneCodeDayMatched,false);
 }
});
test('tampered empty-day aggregates with a fake price or volume never become no-trade evidence',()=>{
 const source=dailyRows();
 source[1]={Date:date,Code:'37620',O:null,H:null,L:null,C:null,Vo:null,
  AdjFactor:1,ExRT:null};
 const correct=daily(source),none=minute([]);
 for(const change of [{open:100},{volume:1},{turnover:1},{close:90}]){
  const m={...none,dailyObservation:{...none.dailyObservation,...change}};
  const r=audit(m,correct);
  assert.ok(r.blockers.includes('INVALID_MINUTE_DAY_AGGREGATE'));
  assert.equal(r.matchingNoTradeSession,false);
 }
});
test('corrupted minute geometry cannot be used to reconstruct a daily close with guessed extrema',()=>{
 const d=daily(),m=minute();
 const distorted={...m.dailyObservation,high:50,low:120};
 const r=audit({...m,dailyObservation:distorted},d);
 assert.ok(r.blockers.includes('INVALID_MINUTE_DAY_AGGREGATE'));
 assert.equal(r.structuralOneCodeDayMatched,false);
});

test('real daily-parser foreign date alongside valid code cannot silently pass daily reconciliation',()=>{
 const foreign={...dailyRows()[0],Date:'2026-10-29'};
 const original=dailyRows();
 const d=daily([...original,foreign]);
 assert.equal(d.rows.find(x=>x.code===code).status,'DAILY_BAR');
 assert.equal(d.unmappedRows.length,1);
 const r=audit(minute(),d);
 assert.ok(r.blockers.includes('INVALID_OR_DIFFERENT_DAILY_AUDIT'));
 assert.equal(r.structuralOneCodeDayMatched,false);
});
test('real daily-parser unexpected out-of-cohort code is not ignored when checking one-code/day provider integrity',()=>{
 const foreign={...dailyRows()[1],Code:'99990'};
 const d=daily([...dailyRows(),foreign]);
 assert.deepEqual(d.outsideFrozenCodes,['9999']);
 assert.equal(d.rows.find(x=>x.code===code).status,'DAILY_BAR');
 const r=audit(minute(),d);
 assert.ok(r.blockers.includes('INVALID_OR_DIFFERENT_DAILY_AUDIT'));
 assert.equal(r.structuralOneCodeDayMatched,false);
});
test('real duplicated daily-provider row quarantines reconciliation, even if its price matches',()=>{
 const d=daily([...dailyRows(),{...dailyRows()[1]}]);
 assert.deepEqual(d.duplicateCodeDates,['3762:'+date]);
 const r=audit(minute(),d);
 assert.equal(r.structuralOneCodeDayMatched,false);
 assert.ok(r.blockers.includes('INVALID_OR_DIFFERENT_DAILY_AUDIT'));
});
test('daily provider page captured at 15:45 JST does not qualify as post-update history',()=>{
 const d=daily();
 const earlier={...d,firstReceivedAt:'2026-10-30T06:45:00Z',
   lastReceivedAt:'2026-10-30T06:45:00Z'};
 const r=audit(minute(),earlier);
 assert.ok(r.blockers.includes('INVALID_OR_DIFFERENT_DAILY_AUDIT'));
 assert.equal(r.structuralOneCodeDayMatched,false);
});


test('a matching one-code day does not certify missing other frozen stocks',()=>{
 const fullDatePage=daily([dailyRows()[1]]);
 assert.equal(fullDatePage.auditScope,'FROZEN_UNIVERSE');
 assert.equal(fullDatePage.rows.find(x=>x.code==='1301').status,'MISSING_PROVIDER_ROW');
 const result=audit(minute(),fullDatePage);
 assert.equal(result.structuralOneCodeDayMatched,true);
 assert.equal(result.providerQueryScope,'FROZEN_UNIVERSE');
 assert.equal(result.fullFrozenUniverseCovered,false);
 assert.equal(result.dailyObservedCodeDays,1);
 assert.equal(result.dailyMissingOrQuarantinedCodeDays,1);
 assert.equal(result.eligibleForProduction,false);
});
test('only both completed frozen stock-days can carry full-source coverage metadata',()=>{
 const r=audit();
 assert.equal(r.structuralOneCodeDayMatched,true);
 assert.equal(r.frozenTradeDateRecordsComplete,true);
 assert.equal(r.fullFrozenUniverseCovered,false);
 assert.equal(r.requiredSessionDatesForMa75,76);
 assert.equal(r.frozen76SessionHistoryVerified,false);
 assert.equal(r.dailyObservedCodeDays,2);
 assert.equal(r.dailyMissingOrQuarantinedCodeDays,0);
 assert.equal(r.directProviderCaptureAuthenticated,false);
});
test('corporate action review on OTHER stock blocks 2-stock coverage but not target code/day audit',()=>{
 const rows=dailyRows();
 rows[0]={...rows[0],AdjFactor:0.5};
 const r=audit(minute(),daily(rows));
 assert.equal(r.structuralOneCodeDayMatched,true);
 assert.equal(r.fullFrozenUniverseCovered,false);
 assert.equal(r.dailyObservedCodeDays,1);
 assert.equal(r.dailyMissingOrQuarantinedCodeDays,1);
});
test('genuine no-trade on other stock is structurally present but not a buy recommendation',()=>{
 const rows=dailyRows();
 rows[0]={Date:date,Code:'13010',O:null,H:null,L:null,C:null,Vo:null,
   AdjFactor:1,ExRT:null};
 const r=audit(minute(),daily(rows));
 assert.equal(r.frozenTradeDateRecordsComplete,true);
 assert.equal(r.fullFrozenUniverseCovered,false);
 assert.equal(r.requiredSessionDatesForMa75,76);
 assert.equal(r.frozen76SessionHistoryVerified,false);
 assert.equal(r.dailyObservedCodeDays,2);
 assert.equal(r.eligibleForNotifications,false);
});
test('one-stock pilot preserves its tiny denominator and never says full frozen universe',()=>{
 const m=minute();
 const d=parseMa75JQuantsDailyPages(freeze(),{
  date,requestedCode:code,
  pages:[{requestPaginationKey:null,receivedAt:'2026-11-01T08:00:00Z',
    response:{data:[dailyRows()[1]]}}]
 });
 const r=audit(m,d);
 assert.equal(r.structuralOneCodeDayMatched,true);
 assert.equal(r.providerQueryScope,'SINGLE_CODE_PILOT');
 assert.equal(r.frozenPopulationSize,2);
 assert.equal(r.dailyObservedCodeDays,1);
 assert.equal(r.fullFrozenUniverseCovered,false);
});
test('unsupported daily audit scope cannot be used to claim full coverage',()=>{
 const d=daily();
 const r=audit(minute(),{...d,auditScope:'MADE_UP_SCOPE'});
 assert.ok(r.blockers.includes('INVALID_OR_DIFFERENT_DAILY_AUDIT'));
 assert.equal(r.providerQueryScope,'INVALID_SCOPE');
 assert.equal(r.fullFrozenUniverseCovered,false);
});


test('legacy or absent full-cohort audit scope cannot be silently promoted to full coverage',()=>{
 const valid=daily();
 for(const changed of [
  {auditScope:undefined},
  {originalFrozenCohortSize:undefined},
  {requestedCode:undefined},
  {originalFrozenCohortSize:1},
  {requestedCode:code}
 ]){
  const r=audit(minute(),{...valid,...changed});
  assert.ok(r.blockers.includes('INVALID_OR_DIFFERENT_DAILY_AUDIT'));
  assert.equal(r.structuralOneCodeDayMatched,false);
  assert.equal(r.fullFrozenUniverseCovered,false);
  assert.equal(r.eligibleForProduction,false);
 }
});

test('even all frozen symbols on exactly one date cannot prove the 76-session SMA75 history',()=>{
 const r=audit();
 assert.equal(r.providerQueryScope,'FROZEN_UNIVERSE');
 assert.equal(r.frozenTradeDateRecordsComplete,true);
 assert.equal(r.sessionDatesActuallyReconciled,1);
 assert.equal(r.requiredSessionDatesForMa75,76);
 assert.equal(r.frozen76SessionHistoryVerified,false);
 assert.equal(r.fullFrozenUniverseCovered,false);
 assert.equal(r.originalProviderEntitlementVerified,false);
 assert.equal(r.eligibleForProduction,false);
});
test('a one-stock daily source may match its day but can never claim one-date full-cohort completeness',()=>{
 const d=parseMa75JQuantsDailyPages(freeze(),{
  date,requestedCode:code,pages:[{
   requestPaginationKey:null,receivedAt:'2026-11-01T08:00:00Z',
   response:{data:[dailyRows()[1]]}
  }]
 });
 const r=audit(minute(),d);
 assert.equal(r.structuralOneCodeDayMatched,true);
 assert.equal(r.dailyObservedCodeDays,1);
 assert.equal(r.frozenTradeDateRecordsComplete,false);
 assert.equal(r.sessionDatesActuallyReconciled,1);
 assert.equal(r.frozen76SessionHistoryVerified,false);
});
