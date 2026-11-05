import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertContinuousTseSessions,sessionDailyPrices,evaluateTradingDaySignals,
  evaluateJQuantsFourPatternTradingDays,
} from '../app/lib/research/fourPatternTradingDayForward.mjs';
import {summarizeFourPatternTradingDays} from
 '../scripts/research/run-four-pattern-trading-days.mjs';
import {
  TSE_MARKET_CALENDAR,resolveTseTradingDatesAfter,
} from '../app/lib/technicalObservation/tseMarketCalendar.ts';

const dates=['2026-10-29','2026-10-30','2026-11-02','2026-11-04','2026-11-05'];
const amounts=[100,110,112,120,125];
function sessions(prices=amounts){
 return dates.map((date,i)=>({date,dailyMatched:true,minutes:[
  {open:prices[i],high:prices[i]+2,low:prices[i]-2,close:prices[i]+1},
 ]}));
}
function fakeStudy(){
 const candles=dates.map((day,i)=>({
  time:Math.floor(Date.parse(day+'T15:31:00+09:00')/1000),
  barDate:day,
 }));
 return {report:{status:'OFFLINE_SHADOW_ONLY',rows:[
   {strategy:'BREAKOUT_RETEST',signalTime:candles[0].time},
   {strategy:'BREAKOUT_RETEST',signalTime:candles[0].time},
   {strategy:'HIGHER_LOW',signalTime:candles[2].time},
  ]},candles};
}
test('JPX holiday Nov 3 is skipped and 1/3/5 means sessions, not bars',()=>{
 assert.deepEqual(resolveTseTradingDatesAfter('2026-10-29',5),[
  '2026-10-30','2026-11-02','2026-11-04','2026-11-05','2026-11-06',
 ]);
 const a=assertContinuousTseSessions(sessions());
 assert.equal(a.contiguousTradingDates,true);
 assert.equal(a.verifiedSessions,5);
 assert.equal(a.calendarVersion,TSE_MARKET_CALENDAR.version);
});
test('missing official trading session blocks evaluation rather than shrinking horizon',()=>{
 const subset=sessions().filter(x=>x.date!=='2026-10-30');
 assert.throws(()=>assertContinuousTseSessions(subset),/MISSING_INTERVENING_TRADING_SESSION/);
 const extra=sessions();extra[0].date='2026-11-03';
 assert.throws(()=>assertContinuousTseSessions(extra),/NONTRADING_DATE_IN_ARCHIVE/);
});
test('distinct 1/3/5 trading day outcomes use NEXT DAY OPEN and target date CLOSE',()=>{
 const a=fakeStudy();
 const r=evaluateTradingDaySignals({...a,sessions:sessions()});
 assert.equal(r.status,'TSE_CALENDAR_VERIFIED_RETROSPECTIVE_ONLY');
 assert.equal(r.metricsUnit,'TSE_TRADING_DAYS');
 assert.equal(r.originalSignals,3);
 assert.equal(r.uniqueDateStrategySignals,2);
 assert.equal(r.duplicateSameDayStrategySignalsDiscarded,1);
 const row=r.signals.find(s=>s.strategy==='BREAKOUT_RETEST');
 assert.equal(row.signalDate,'2026-10-29');
 const o1=row.outcomes[0],o3=row.outcomes[1],o5=row.outcomes[2];
 assert.equal(o1.status,'HISTORICAL_HYPOTHETICAL_ONLY');
 assert.equal(o1.entryDate,'2026-10-30');
 assert.equal(o1.exitDate,'2026-10-30');
 assert.equal(o1.profitYen100,1079);
 assert.equal(o3.exitDate,'2026-11-04');
 assert.equal(o3.profitYen100,2077);
 assert.equal(o5.exitDate,'2026-11-06');
 assert.equal(o5.status,'PENDING');
 assert.equal(o5.returnPercent,null);
 assert.equal(o5.profitYen100,null);
});
test('future target missing after last verified session is PENDING, not a made-up exit',()=>{
 const a=fakeStudy();
 const r=evaluateTradingDaySignals({...a,sessions:sessions()});
 const later=r.signals.find(s=>s.strategy==='HIGHER_LOW');
 assert.equal(later.outcomes[0].exitDate,'2026-11-04');
 assert.equal(later.outcomes[1].status,'PENDING');
 assert.equal(later.outcomes[2].status,'PENDING');
 const hl=r.summaries.find(s=>s.strategy==='HIGHER_LOW');
 assert.deepEqual(hl.horizons.map(x=>x.pending),[0,1,1]);
});
test('100-share price over budget is EXCLUDED rather than a fictitious profit',()=>{
 const a=fakeStudy();
 const expensive=sessions(amounts.map(x=>x*100));
 const r=evaluateTradingDaySignals({...a,sessions:expensive});
 const signal=r.signals.find(s=>s.strategy==='BREAKOUT_RETEST');
 assert.equal(signal.outcomes[0].status,'BUDGET_EXCLUDED');
 assert.equal(signal.outcomes[0].profitYen100,null);
 const sum=r.summaries.find(s=>s.strategy==='BREAKOUT_RETEST');
 assert.equal(sum.horizons[0].budgetExcluded,1);
 assert.equal(sum.horizons[0].measured,0);
});
test('calendar missing or outside coverage must not fabricate trading-day results',()=>{
 const a=fakeStudy();
 assert.throws(()=>assertContinuousTseSessions(sessions(),{calendar:null}),
  /TSE_MARKET_CALENDAR_UNVERIFIED/);
 const beyond=sessions();beyond[0].date='2028-01-05';
 assert.throws(()=>assertContinuousTseSessions(beyond),/TSE_MARKET_CALENDAR_UNVERIFIED/);
 assert.throws(()=>evaluateTradingDaySignals({...a,sessions:sessions(),calendar:null}),
  /TSE_MARKET_CALENDAR_UNVERIFIED/);
});
test('price outcomes, 5-session median, pending count and dedup stable across input order',()=>{
 const a=fakeStudy();
 const r=evaluateTradingDaySignals({...a,sessions:sessions()});
 const summary=r.summaries.find(x=>x.strategy==='BREAKOUT_RETEST');
 assert.equal(summary.uniqueSignalDays,1);
 assert.equal(summary.horizons[0].measured,1);
 assert.equal(summary.horizons[2].pending,1);
 assert.equal(summary.horizons[2].winRatePercent,null);
 assert.equal(summary.horizons[0].winRatePercent,100);
 assert.equal(summary.horizons[0].averageProfitYen100,1079);
});
test('unverified research report returns insufficient without any implied win rate',()=>{
 const a=fakeStudy();
 const result=evaluateTradingDaySignals({report:{status:'INSUFFICIENT_OR_EXCESSIVE_HISTORY'},
  candles:a.candles,sessions:sessions()});
 assert.equal(result.status,'PATTERN_HISTORY_INSUFFICIENT');
 assert.deepEqual(result.signals,[]);
});
test('offline wrapper blocks missing archive and never asserts production readiness',()=>{
 const result=evaluateJQuantsFourPatternTradingDays({code:'3762',minuteDays:[],dailyDays:[]});
 assert.match(result.status,/^BLOCKED_/);
 assert.equal(result.eligibleForNotifications,false);
 assert.equal(result.eligibleForProduction,false);
 const display=summarizeFourPatternTradingDays({code:'3762',minuteDays:[],dailyDays:[]});
 assert.match(display.status,/^BLOCKED_/);
});
test('original 20-day minute archive can be evaluated without provider calls',()=>{
 const days=[
 '2026-10-06','2026-10-07','2026-10-08','2026-10-09','2026-10-13',
 '2026-10-14','2026-10-15','2026-10-16','2026-10-19','2026-10-20',
 '2026-10-21','2026-10-22','2026-10-23','2026-10-26','2026-10-27',
 '2026-10-28','2026-10-29','2026-10-30','2026-11-02','2026-11-04',
 ];
 const receivedAt='2026-11-05T08:00:00Z', code='3762';
 const pg=rows=>[{receivedAt,requestPaginationKey:null,response:{data:rows}}];
 const minutes=[],daily=[];
 for(let i=0;i<days.length;i++){
  const date=days[i],base=200+i;
  const t=['09:00','09:30','10:00','11:30','12:30','15:30'];
  const rows=t.map((time,k)=>({
   Date:date,Time:time,Code:'37620',
   O:base,H:base+2,L:base-1,C:k===t.length-1?base+1:base,
   Vo:100,Va:base*100,
  }));
  minutes.push({date,pages:pg(rows)});
  daily.push({date,pages:pg([{
   Date:date,Code:'37620',O:base,H:base+2,L:base-1,C:base+1,
   Vo:600,AdjFactor:1,ExRT:null,
  }])});
 }
 const result=evaluateJQuantsFourPatternTradingDays({
  code,minuteDays:minutes,dailyDays:daily,financialPages:null,
 },{timeframe:'BOTH'});
 assert.equal(result.status,'RETROSPECTIVE_TSE_DAY_EVALUATION_SHADOW_ONLY');
 assert.equal(result.validatedTradeDates,20);
 assert.equal(result.originalMinuteBars,120);
 assert.equal(result.results.length,2);
 assert.equal(result.eligibleForNotifications,false);
 assert.equal(result.eligibleForProduction,false);
 assert.ok(result.results.every(x=>x.status==='TSE_CALENDAR_VERIFIED_RETROSPECTIVE_ONLY'));
 const display=summarizeFourPatternTradingDays({
  code,minuteDays:minutes,dailyDays:daily,
 });
 assert.equal(display.horizonUnit,'TSE_TRADING_DAYS_NOT_INTRADAY_BARS');
 assert.equal(display.canTriggerTrade,false);
 assert.equal(display.results.length,2);
});
