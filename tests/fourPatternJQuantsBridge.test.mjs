import assert from 'node:assert/strict';
import test from 'node:test';
import {
  auditCapturedPages, reconcileCapturedTradeDay,
  aggregateReconciledMinutes, convertCapturedFinancialSummary,
  studyCapturedJQuantsFourPatterns,
} from '../app/lib/research/fourPatternJQuantsBridge.mjs';
import { verifiedFundamentalsAt } from '../app/lib/research/fourStrategyShadow.mjs';

const code='7203', date='2026-10-30', receivedAt='2026-11-03T08:00:00Z';
const row = (Time, O, H, L, C, Vo=100) => ({
  Date:date,Time,Code:'72030',O,H,L,C,Vo,Va:C*Vo
});
function fixture() {
  const minutes=[
    row('09:00',100,101,99,100),
    row('09:29',100,102,100,101),
    row('09:30',101,103,100,102),
    row('11:30',102,104,102,103),
    row('12:30',103,105,102,104),
    row('15:30',104,106,103,105),
  ];
  const daily={Date:date,Code:'72030',O:100,H:106,L:99,C:105,Vo:600,AdjFactor:1,ExRT:null};
  const pg=rows=>[{requestPaginationKey:null,receivedAt,response:{data:rows}}];
  return {minutePages:pg(minutes),dailyPages:pg([daily])};
}
const fin=(period,date,discDate,sales,op,cfo,eq='0.45',discNo='1')=>({
  Code:'72030',DiscDate:discDate,DiscTime:'15:00:00',DiscNo:discNo,
  CurPerType:period,CurPerEn:date,Sales:String(sales),OP:String(op),CFO:String(cfo),EqAR:eq,
});
const financialPages = () => [{requestPaginationKey:null,receivedAt,response:{data:[
  fin('FY','2025-03-31','2025-05-14',1000,100,50,'0.36','prev'),
  fin('FY','2026-03-31','2026-05-14',1150,120,70,'0.47','current'),
]}}];
test('full validated pagination with monotonic receipt and terminal token', () => {
  const pages=[{requestPaginationKey:null,receivedAt,response:{data:[1],pagination_key:'next'}},
    {requestPaginationKey:'next',receivedAt,response:{data:[2]}}];
  assert.deepEqual(auditCapturedPages(pages,4,2).rows,[1,2]);
  pages[1].requestPaginationKey='wrong';
  assert.throws(()=>auditCapturedPages(pages,4,2),/BROKEN_PAGINATION_CHAIN/);
  pages[1].requestPaginationKey='next';
  pages[1].response.pagination_key='repeated';
  assert.throws(()=>auditCapturedPages(pages,4,2),/INCOMPLETE_PAGINATION/);
});
test('reconcile original unadjusted daily candle, no filled missing minute', () => {
  const f=fixture();
  const a=reconcileCapturedTradeDay({code,date,...f});
  assert.equal(a.dailyMatched,true);
  assert.equal(a.minutes.length,6);
  assert.equal(a.noTradeMinutesImputed,false);
  assert.equal(a.minuteBarCount,6);
});
test('daily or minute provider mismatch, duplicates and rights fail closed', () => {
  const f=fixture();
  f.dailyPages[0].response.data[0].Vo=1000;
  assert.throws(()=>reconcileCapturedTradeDay({code,date,...f}),/MISMATCH/);
  const g=fixture();g.minutePages[0].response.data.push(g.minutePages[0].response.data[0]);
  assert.throws(()=>reconcileCapturedTradeDay({code,date,...g}),/DUPLICATE_MINUTE/);
  const s=fixture();s.dailyPages[0].response.data[0].AdjFactor=0.5;
  assert.throws(()=>reconcileCapturedTradeDay({code,date,...s}),/CORPORATE_ACTION/);
  const bad=fixture();bad.minutePages[0].response.data[4].Time='15:27';
  assert.throws(()=>reconcileCapturedTradeDay({code,date,...bad}),/SESSION/);
});
test('late archive receipt is allowed only for retrospective study, not 09:05', () => {
  const f=fixture();
  f.minutePages[0].receivedAt='2026-10-30T05:00:00Z';
  assert.throws(()=>reconcileCapturedTradeDay({code,date,...f}),/TOO_EARLY/);
});
test('30/60 minute completed buckets split at lunch and include close auctions', () => {
  const d=reconcileCapturedTradeDay({code,date,...fixture()});
  const half=aggregateReconciledMinutes([d],30);
  const hour=aggregateReconciledMinutes([d],60);
  assert.equal(half.length,5);
  assert.equal(hour.length,5);
  assert.equal(half[0].volume,200);
  assert.equal(half[0].open,100);
  assert.equal(half[0].close,101);
  assert.equal(half[0].time,Date.parse('2026-10-30T09:30:00+09:00')/1000);
  assert.equal(half[2].time,Date.parse('2026-10-30T11:31:00+09:00')/1000);
  assert.equal(half.at(-1).time,Date.parse('2026-10-30T15:31:00+09:00')/1000);
  assert.equal(half.reduce((s,b)=>s+b.volume,0),600);
  assert.equal(hour.reduce((s,b)=>s+b.volume,0),600);
});
test('fundamental YoY compares matched period and gates to actual capture receipt', () => {
  const r=convertCapturedFinancialSummary({code,pages:financialPages()});
  assert.equal(r.status,'CAPTURE_GATED_FINANCIAL_ONLY');
  assert.equal(r.fundamentals.length,1);
  const f=r.fundamentals[0];
  assert.equal(f.revenueGrowthPct,15);
  assert.equal(f.operatingProfitGrowthPct,20);
  assert.equal(f.equityRatioPct,47); // J-Quants EqAR is fractional.
  assert.equal(f.operatingCashFlowYen,70);
  assert.equal(verifiedFundamentalsAt(r.fundamentals,
    Date.parse('2026-05-15T00:00:00Z')/1000),null);
  assert.ok(verifiedFundamentalsAt(r.fundamentals,f.publishedAt));
});
test('empty CFO, negative prior OP and future-only disclosures cannot create quality', () => {
  const noCfo=financialPages();
  noCfo[0].response.data[1].CFO='';
  assert.equal(convertCapturedFinancialSummary({code,pages:noCfo}).fundamentals.length,0);
  const negative=financialPages();
  negative[0].response.data[0].OP='-25';
  assert.equal(convertCapturedFinancialSummary({code,pages:negative}).fundamentals.length,0);
  const future=financialPages();
  future[0].response.data[1].DiscDate='2026-11-04';
  assert.equal(convertCapturedFinancialSummary({code,pages:future})
    .fundamentals[0]?.publishedAt > Date.parse(receivedAt)/1000,true);
});
test('bad code and mixed financial symbol reject instead of guessing', () => {
  const pages=financialPages();
  pages[0].response.data[1].Code='99840';
  assert.throws(()=>convertCapturedFinancialSummary({code,pages}),/FINANCIAL_WRONG_CODE/);
  const out=studyCapturedJQuantsFourPatterns({code:'bad',minuteDays:[],dailyDays:[]});
  assert.equal(out.reports.length,0);
  assert.equal(out.eligibleForNotifications,false);
});
test('both studies remain shadow-only, no silent positive outcome for too few bars', () => {
  const f=fixture();
  const report=studyCapturedJQuantsFourPatterns({
    code,minuteDays:[{date,pages:f.minutePages}],
    dailyDays:[{date,pages:f.dailyPages}],
    financialPages:financialPages(),timeframe:'BOTH',
  });
  assert.equal(report.status,'HISTORICAL_RECONCILED_SHADOW_ONLY');
  assert.equal(report.timeframes.length,2);
  assert.equal(report.financialAsOfSnapshots,1);
  assert.equal(report.eligibleForProduction,false);
  assert.equal(report.eligibleForNotifications,false);
  assert.ok(report.reports.every(x=>x.report.status==='INSUFFICIENT_OR_EXCESSIVE_HISTORY'));
});
test('one bad day blocks entire multi-day study instead of releasing partial results', () => {
  const f=fixture();
  const swapped=fixture();
  swapped.minutePages[0].response.data[0].Date='2026-10-31';
  const r=studyCapturedJQuantsFourPatterns({
    code,minuteDays:[{date,pages:f.minutePages},
      {date:'2026-10-31',pages:swapped.minutePages}],
    dailyDays:[{date,pages:f.dailyPages},
      {date:'2026-10-31',pages:swapped.dailyPages}],
  });
  assert.match(r.status,/^BLOCKED_/);
  assert.equal(r.reports.length,0);
});
