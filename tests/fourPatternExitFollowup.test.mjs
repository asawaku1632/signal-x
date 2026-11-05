import assert from 'node:assert/strict';
import test from 'node:test';
import {REPLICATION_PLAN} from
 '../app/lib/research/fourPatternReplicationPlan.mjs';
import {studyCapturedJQuantsFourPatterns,
 reconcileCapturedTradeDay,aggregateReconciledMinutes}
 from '../app/lib/research/fourPatternJQuantsBridge.mjs';
import {evaluateTradingDaySignals} from
 '../app/lib/research/fourPatternTradingDayForward.mjs';
import {
 pinnedExitFollowupDates,evaluateFrozenFourPatternExitFollowup,
 evaluateFrozenFourPatternExitCohort,
} from '../app/lib/research/fourPatternExitFollowup.mjs';
import {pinnedFollowupManifest,runFrozenExitCohortLocal}
 from '../scripts/research/run-four-pattern-frozen-exit-cohort.mjs';

const code='3762',baseDates=REPLICATION_PLAN.plannedNextPeriod.tradingDates,
 tailDates=['2026-12-07','2026-12-08','2026-12-09','2026-12-10','2026-12-11'];
const receipt='2026-12-15T08:00:00Z';
const page=rows=>[{requestPaginationKey:null,receivedAt:receipt,response:{data:rows}}];
const times=['09:00','09:30','10:00','11:30','12:30','15:30'];
function fixture(stock,dates,offset=0){
 const minuteDays=[],dailyDays=[];
 for(let i=0;i<dates.length;i++){
  const date=dates[i],open=200+offset+i;
  const rows=times.map((Time,k)=>({
   Date:date,Time,Code:stock+'0',
   O:open,H:open+2,L:open-1,C:k===times.length-1?open+1:open,
   Vo:100,Va:open*100,
  }));
  minuteDays.push({date,pages:page(rows)});
  dailyDays.push({date,pages:page([{
   Date:date,Code:stock+'0',O:open,H:open+2,L:open-1,C:open+1,
   Vo:600,AdjFactor:1,ExRT:null,
  }])});
 }
 return {code:stock,minuteDays,dailyDays,financialPages:null};
}
const pair=(stock=code)=>({
 originalArchive:fixture(stock,baseDates),
 followupArchive:fixture(stock,tailDates,20),
});
const codes=REPLICATION_PLAN.plannedNextPeriod.codes;
const safeStatus='RETROSPECTIVE_TSE_DAY_EVALUATION_SHADOW_ONLY';

test('frozen five follow-up trading days end on 11 Dec without weekend or holiday',()=>{
 assert.deepEqual(pinnedExitFollowupDates(),tailDates);
 const manifest=pinnedFollowupManifest();
 assert.equal(manifest.status,'FUTURE_CAPTURE_MANIFEST_PLAN_ONLY');
 assert.equal(manifest.archivePairs.length,6);
 assert.equal(manifest.apiRequestsFromThisTool,0);
 assert.equal(manifest.archivePairs[0].signalArchive,
  'four-pattern-jquants-1301-2026-11-06-2026-12-04.json');
 assert.equal(manifest.archivePairs[0].exitOnlyArchive,
  'four-pattern-jquants-1301-2026-12-07-2026-12-11.json');
 assert.equal(runFrozenExitCohortLocal(['--plan'],{
  readArchive:()=>{throw Error('SHOULD_NOT_READ_ARCHIVE')}
 }).status,'FUTURE_CAPTURE_MANIFEST_PLAN_ONLY');
});
test('valid original 20 + tail 5 are isolated; signal times remain from original 20 only',()=>{
 const {originalArchive,followupArchive}=pair();
 const r=evaluateFrozenFourPatternExitFollowup({originalArchive,followupArchive});
 assert.equal(r.status,safeStatus);
 assert.equal(r.noSignalsFromFollowup,true);
 assert.equal(r.validatedTradeDates,20);
 assert.equal(r.validatedFollowupTradeDates,5);
 assert.equal(r.originalMinuteBars,120);
 assert.equal(r.followupMinuteBars,30);
 assert.equal(r.results.length,2);
 assert.equal(r.eligibleForNotifications,false);
 assert.equal(r.eligibleForProduction,false);
 const source=studyCapturedJQuantsFourPatterns({...originalArchive,timeframe:'BOTH'});
 assert.deepEqual(r.results.map(x=>x.intradaySignalCount),
  source.reports.map(x=>x.report.rows.length));
 for(const timeframe of r.results){
  assert.ok(timeframe.signals.every(s=>s.signalDate<='2026-12-04'));
 }
});
test('a 4-day tail is refused; no substituting the last known day as exit',()=>{
 const p=pair();
 p.followupArchive.minuteDays.pop();
 p.followupArchive.dailyDays.pop();
 assert.equal(evaluateFrozenFourPatternExitFollowup(p).status,
  'BLOCKED_ARCHIVE_DATES_OUTSIDE_FROZEN_PLAN');
});
test('incorrect tail day, duplicate day, wrong stock or financial data are rejected',()=>{
 const a=pair();a.followupArchive.minuteDays[2].date='2026-12-10';
 assert.equal(evaluateFrozenFourPatternExitFollowup(a).status,
  'BLOCKED_MISSING_OR_UNPAIRED_DATES');
 const extra=pair();
 extra.followupArchive.minuteDays[2].date='2026-12-10';
 extra.followupArchive.dailyDays[2].date='2026-12-10';
 assert.equal(evaluateFrozenFourPatternExitFollowup(extra).status,
  'BLOCKED_ARCHIVE_DATES_OUTSIDE_FROZEN_PLAN');
 const b=pair();b.followupArchive.code='7203';
 assert.equal(evaluateFrozenFourPatternExitFollowup(b).status,
  'BLOCKED_WRONG_ARCHIVE_STOCK_CODE');
 const c=pair();c.followupArchive.financialPages=[];
 assert.equal(evaluateFrozenFourPatternExitFollowup(c).status,
  'BLOCKED_FINANCIAL_PAGES_NOT_ALLOWED');
 const d=pair();d.originalArchive.minuteDays.pop();d.originalArchive.dailyDays.pop();
 assert.equal(evaluateFrozenFourPatternExitFollowup(d).status,
  'BLOCKED_ARCHIVE_DATES_OUTSIDE_FROZEN_PLAN');
});
test('corporate action/price mismatch, missing minute pagination and pre-close receipt block tail',()=>{
 const a=pair();
 a.followupArchive.dailyDays[0].pages[0].response.data[0].Vo=777;
 assert.equal(evaluateFrozenFourPatternExitFollowup(a).status,
  'BLOCKED_UNADJUSTED_MINUTE_DAILY_MISMATCH');
 const b=pair();
 b.followupArchive.minuteDays[0].pages[0].response.pagination_key='more';
 assert.equal(evaluateFrozenFourPatternExitFollowup(b).status,
  'BLOCKED_INCOMPLETE_PAGINATION');
 const c=pair();
 c.followupArchive.minuteDays[0].pages[0].receivedAt='2026-12-07T05:00:00Z';
 assert.equal(evaluateFrozenFourPatternExitFollowup(c).status,
  'BLOCKED_INVALID_OR_TOO_EARLY_CAPTURE');
 const d=pair();d.followupArchive.dailyDays[0].pages[0].response.data[0].AdjFactor=0.5;
 assert.equal(evaluateFrozenFourPatternExitFollowup(d).status,
  'BLOCKED_MISSING_OR_NONUNIT_CORPORATE_ACTION_METADATA');
});
test('20-day original signals are frozen; Dec 4 last signal 5th TSE exit resolves to Dec 11',()=>{
 const original=pair().originalArchive;
 const tail=pair().followupArchive;
 const baseSessions=original.minuteDays.map((d,i)=>reconcileCapturedTradeDay({
  code,date:d.date,minutePages:d.pages,dailyPages:original.dailyDays[i].pages,
 }));
 const tailSessions=tail.minuteDays.map((d,i)=>reconcileCapturedTradeDay({
  code,date:d.date,minutePages:d.pages,dailyPages:tail.dailyDays[i].pages,
 }));
 const candles=aggregateReconciledMinutes(baseSessions,30);
 const last=candles.at(-1);
 const report={status:'OFFLINE_SHADOW_ONLY',rows:[{
  strategy:'EMA_COMPRESSION',signalTime:last.time,
 }]};
 const before=evaluateTradingDaySignals({
  report,candles,sessions:baseSessions,
 });
 const after=evaluateTradingDaySignals({
  report,candles,sessions:[...baseSessions,...tailSessions],
 });
 const b=before.signals[0].outcomes,a=after.signals[0].outcomes;
 assert.deepEqual(b.map(x=>x.status),['PENDING','PENDING','PENDING']);
 assert.deepEqual(a.map(x=>x.status),
  ['HISTORICAL_HYPOTHETICAL_ONLY','HISTORICAL_HYPOTHETICAL_ONLY',
   'HISTORICAL_HYPOTHETICAL_ONLY']);
 assert.deepEqual(a.map(x=>x.entryDate),Array(3).fill('2026-12-07'));
 assert.deepEqual(a.map(x=>x.exitDate),
  ['2026-12-07','2026-12-09','2026-12-11']);
 assert.ok(a.every(x=>Number.isFinite(x.profitYen100)));
 assert.equal(after.signals[0].signalDate,'2026-12-04');
 assert.equal(after.signals.length,before.signals.length);
});
test('six pinned symbols aggregate only original-window signals with exit-only tail',()=>{
 const items=codes.map(stock=>pair(stock));
 const r=evaluateFrozenFourPatternExitCohort(items);
 assert.equal(r.status,'FROZEN_SIX_STOCK_EXIT_TAIL_RECONCILED_SHADOW_ONLY');
 assert.equal(r.stockCount,6);
 assert.equal(r.originalSignalMinuteBars,720);
 assert.equal(r.tailOnlyMinuteBars,180);
 assert.equal(r.outcomeOnlyFollowupDates.length,5);
 assert.equal(r.noSignalsFromFollowup,true);
 assert.equal(r.results.stockCount,6);
 assert.equal(r.results.verifiedTradeDaysPerStock,20);
 assert.equal(r.results.byStrategy.length,3);
 assert.equal(r.results.leaveOneStockOut.outcomes.length,6);
 assert.equal(r.eligibleForProduction,false);
 assert.equal(r.canTriggerTrade,false);
});
test('six-stock pinned cohort rejects missing or duplicate symbols, even if rest valid',()=>{
 const items=codes.map(stock=>pair(stock));
 assert.equal(evaluateFrozenFourPatternExitCohort(items.slice(1)).status,
  'BLOCKED_REQUIRED_SIX_PREDECLARED_STOCKS');
 items[1]=pair(codes[0]);
 assert.equal(evaluateFrozenFourPatternExitCohort(items).status,
  'BLOCKED_UNEXPECTED_OR_DUPLICATE_COHORT_STOCK');
});
test('local CLI never reads raw data in plan mode; evaluate mode reads exact 12 pinned files',()=>{
 const items=codes.map(stock=>pair(stock));
 const data=new Map();
 const manifest=pinnedFollowupManifest();
 for(let i=0;i<items.length;i++){
  data.set(manifest.archivePairs[i].signalArchive,items[i].originalArchive);
  data.set(manifest.archivePairs[i].exitOnlyArchive,items[i].followupArchive);
 }
 let reads=0;
 const readArchive=name=>{reads++;if(!data.has(name))throw Error('UNEXPECTED_FILE');return data.get(name)};
 assert.equal(runFrozenExitCohortLocal(['--evaluate'],{readArchive}).status,
  'FROZEN_SIX_STOCK_EXIT_TAIL_RECONCILED_SHADOW_ONLY');
 assert.equal(reads,12);
 assert.equal(runFrozenExitCohortLocal(['--codes=9984'],{readArchive}).status,
  'BLOCKED_USE_PLAN_OR_EXPLICIT_EVALUATE');
 assert.equal(reads,12);
});
