import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {analyzeHistoricalMinutePilotPages} from '../scripts/research/jquants-minute-pilot.mjs';
import {parseMa75JQuantsDailyPages} from '../app/lib/research/ma75JQuantsDailyPages.mjs';

const freeze=JSON.parse(readFileSync(
 new URL('../docs/ma75-forward-cohort-freeze-20261031.json',import.meta.url),'utf8'));
const code='3762',date='2026-10-30',receipt='2026-11-01T08:00:00Z';
const minute=()=>[
 {Date:date,Time:'09:00',Code:'37620',O:100,H:102,L:99,C:101,Vo:100,Va:10050},
 {Date:date,Time:'09:01',Code:'37620',O:101,H:103,L:100,C:102,Vo:200,Va:20300},
 {Date:date,Time:'09:10',Code:'37620',O:102,H:104,L:98,C:99,Vo:50,Va:5000},
 {Date:date,Time:'15:30',Code:'37620',O:100,H:105,L:99,C:103,Vo:150,Va:15300},
];
const daily=()=>[{Date:date,Code:'37620',O:100,H:105,L:98,C:103,Vo:500,
 AdjFactor:1,ExRT:null}];
const makePages=rows=>[{requestPaginationKey:null,receivedAt:receipt,
 response:{data:rows}}];
const study=(dailyRows=daily(),minuteRows=minute())=>
 analyzeHistoricalMinutePilotPages(freeze,{
  code,date,compareDaily:true,
  minutePages:makePages(minuteRows),
  dailyPages:makePages(dailyRows)
 });
test('the real frozen 953-code cohort is immutable and includes study code',()=>{
 assert.equal(freeze.codes.length,953);
 assert.equal(freeze.populationSize,953);
 assert.equal(freeze.codes.includes(code),true);
 assert.equal(freeze.codes.includes('3753'),false);
});
test('single-code provider day does not create 952 fake missing daily rows',()=>{
 const parsed=parseMa75JQuantsDailyPages(freeze,{
  code,date,requestedCode:code,pages:makePages(daily())
 });
 assert.equal(parsed.paginationComplete,true);
 assert.equal(parsed.auditScope,'SINGLE_CODE_PILOT');
 assert.equal(parsed.originalFrozenCohortSize,953);
 assert.equal(parsed.expectedFrozenCodes,1);
 assert.equal(parsed.requestedCode,code);
 assert.equal(parsed.rows.length,1);
 assert.equal(parsed.rows[0].status,'DAILY_BAR');
 assert.equal(parsed.counts.MISSING_PROVIDER_ROW,undefined);
 assert.equal(parsed.eligibleForNotifications,false);
});
test('real 953-symbol frozen universe and one-stock daily query now reconcile end to end',()=>{
 const r=study();
 assert.equal(r.status,'HISTORICAL_MINUTE_DAILY_STRUCTURAL_MATCH');
 assert.equal(r.dailyReconciliationMatched,true);
 assert.equal(r.historicalQualityHold,false);
 assert.equal(r.code,code);
 assert.equal(r.parsedMinuteBars,4);
 assert.equal(r.asOf905.observedMinuteBars,2);
 assert.equal(r.asOf905.close,102);
 assert.equal(r.retrospective.bottomMinute,'09:10');
 assert.equal(r.post905.code,code);
 assert.equal(r.post905.hindsightOnly,true);
 assert.equal(r.eligibleForNotifications,false);
 assert.equal(r.eligibleForProduction,false);
});
test('original 953 frozen symbols stay unchanged after a one-stock study',()=>{
 const before=JSON.stringify(freeze.codes);
 study();
 assert.equal(JSON.stringify(freeze.codes),before);
 assert.equal(freeze.codes.length,953);
});
test('without an independently acquired daily bar, no rebound metrics are released',()=>{
 const r=analyzeHistoricalMinutePilotPages(freeze,{
  code,date,compareDaily:true,minutePages:makePages(minute()),dailyPages:null
 });
 assert.equal(r.status,'BLOCKED_DAILY_RECONCILIATION');
 assert.equal(r.asOf905,null);
 assert.equal(r.retrospective,null);
 assert.equal(r.post905,null);
});
test('wrong date on otherwise correct daily code blocks the entire study',()=>{
 const x={...daily()[0],Date:'2026-10-29'};
 const r=study([x]);
 assert.equal(r.status,'BLOCKED_DAILY_RECONCILIATION');
 assert.equal(r.retrospective,null);
 assert.equal(r.metricsReleasedForHistoricalResearch,false);
});
test('a foreign stock returned alongside the one requested code is quarantined',()=>{
 const x={...daily()[0],Code:'99840'};
 const r=study([...daily(),x]);
 assert.equal(r.status,'BLOCKED_DAILY_RECONCILIATION');
 assert.equal(r.asOf905,null);
 assert.equal(r.post905,null);
});
test('duplicate identical provider daily row blocks even a matching OHLCV payload',()=>{
 const r=study([...daily(),...daily()]);
 assert.equal(r.status,'BLOCKED_DAILY_RECONCILIATION');
 assert.equal(r.retrospective,null);
});
test('explicit corporate action factor means price-path comparison cannot authorize study',()=>{
 const r=study([{...daily()[0],AdjFactor:.5}]);
 assert.equal(r.status,'BLOCKED_DAILY_RECONCILIATION');
 assert.equal(r.metricsReleasedForHistoricalResearch,false);
});
test('one missing executed minute changes volume and withholds the 1%-2% claims',()=>{
 const r=study(daily(),minute().slice(0,3));
 assert.equal(r.status,'BLOCKED_DAILY_RECONCILIATION');
 assert.equal(r.asOf905,null);
 assert.equal(r.post905,null);
});
test('single-code pilot cannot select a stock that was absent from original cohort',()=>{
 assert.throws(()=>parseMa75JQuantsDailyPages(freeze,{
  code:'3753',requestedCode:'3753',date,pages:makePages(daily())
 }),TypeError);
 assert.throws(()=>analyzeHistoricalMinutePilotPages(freeze,{
  code:'3753',date,compareDaily:false,minutePages:makePages(minute())
 }),TypeError);
});
test('empty minute trades and genuine single-code daily no-trade remain no-signal',()=>{
 const noTrade=[{Date:date,Code:'37620',O:null,H:null,L:null,C:null,Vo:null,
  AdjFactor:1,ExRT:null}];
 const r=study(noTrade,[]);
 assert.equal(r.status,'MATCHED_NO_TRADE_NO_SIGNAL');
 assert.equal(r.retrospective,null);
 assert.equal(r.metricsReleasedForHistoricalResearch,false);
 assert.equal(r.eligibleForNotifications,false);
});
