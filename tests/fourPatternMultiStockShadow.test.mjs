import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {
 summarizeMultiStockFourPatternArchives,
 summarizeVerifiedMultiStockFourPatternEvaluations,
 MULTI_STOCK_LIMITS,
} from '../app/lib/research/fourPatternMultiStockShadow.mjs';
import {runMultiStockFourPatternLocal} from
 '../scripts/research/run-four-pattern-multistock-shadow.mjs';

const dates=['2026-10-29','2026-10-30','2026-11-02','2026-11-04'];
const HOR=[1,3,5];
function outcomes(profits=[1000,2000,3000],states=['DONE','DONE','PENDING']){
 return HOR.map((h,i)=>{
  const status=states[i]==='DONE'?'HISTORICAL_HYPOTHETICAL_ONLY':states[i];
  const done=status==='HISTORICAL_HYPOTHETICAL_ONLY';
  return {horizonTradingDays:h,status,entryDate:'2026-10-30',
   exitDate:['2026-10-30','2026-11-04','2026-11-06'][i],
   returnPercent:done?profits[i]/1000:null,
   profitYen100:done?profits[i]:null,
   worstAdversePercent:done?-2:null};
 });
}
function sig(strategy,date='2026-10-29',time=100,profits,states){
 return {strategy,signalDate:date,signalTime:time,outcomes:outcomes(profits,states)};
}
function item(code,rows30=[],rows60=[],opts={}){
 return {archive:{code,financialPages:opts.financialPages??null,
  minuteDays:(opts.dates??dates).map(date=>({date}))},
 evaluation:{status:'RETROSPECTIVE_TSE_DAY_EVALUATION_SHADOW_ONLY',
  code,continuousCalendarVersion:'JPX_MARKET_HOLIDAYS_2026_2027_2026-02-06',
  originalMinuteBars:500,
  results:[{timeframe:'30m',status:'TSE_CALENDAR_VERIFIED_RETROSPECTIVE_ONLY',signals:rows30},
   {timeframe:'60m',status:'TSE_CALENDAR_VERIFIED_RETROSPECTIVE_ONLY',signals:rows60}],
 }};
}
function run(items){return summarizeVerifiedMultiStockFourPatternEvaluations(items)}

test('cross-timeframe same code/date/strategy uses one outcome and earliest signal time',()=>{
 const a=item('3762',
  [sig('BREAKOUT_RETEST','2026-10-29',200)],
  [sig('BREAKOUT_RETEST','2026-10-29',100)]);
 const b=item('7203',[sig('BREAKOUT_RETEST','2026-10-29',250,[-1000,1000,0])]);
 const result=run([a,b]);
 assert.equal(result.status,'MULTI_STOCK_RETROSPECTIVE_SHADOW_ONLY');
 assert.equal(result.stockCount,2);
 assert.equal(result.rawTimeframeSignalCount,3);
 assert.equal(result.timeframeDuplicatesDropped,1);
 assert.equal(result.uniqueStockDateStrategySignals,2);
 assert.equal(result.uniquePortfolioStockDateSignals,2);
 const breakout=result.byStrategy.find(x=>x.strategy==='BREAKOUT_RETEST');
 assert.equal(breakout.uniqueStockDateStrategySignals,2);
 assert.equal(breakout.selected60m,1);
 assert.equal(breakout.selected30m,1);
 assert.equal(breakout.horizons[0].measured,2);
 assert.equal(breakout.horizons[0].winRatePercent,50);
 assert.equal(breakout.horizons[0].averageProfitYen100,0);
 assert.equal(breakout.horizons[0].medianProfitYen100,0);
 assert.equal(breakout.horizons[0].measuredStockCount,2);
 assert.equal(breakout.horizons[2].pending,2);
 assert.equal(breakout.horizons[2].winRatePercent,null);
 assert.equal(result.eligibleForNotifications,false);
 assert.equal(result.eligibleForProduction,false);
 assert.equal(result.canTriggerTrade,false);
});
test('different methods same stock/date remain separate per strategy but portfolio is one',()=>{
 const a=item('3762',[sig('BREAKOUT_RETEST','2026-10-29',500,
  [1000,2000,0]),sig('EMA_COMPRESSION','2026-10-29',100,
  [-2000,-4000,0])]);
 const r=run([a]);
 assert.equal(r.status,'SINGLE_STOCK_PILOT_SHADOW_ONLY');
 assert.equal(r.uniqueStockDateStrategySignals,2);
 assert.equal(r.crossStrategyDuplicatesDropped,1);
 assert.equal(r.uniquePortfolioStockDateSignals,1);
 assert.equal(r.portfolioByTradingDay[0].measured,1);
 assert.equal(r.portfolioByTradingDay[0].averageProfitYen100,-2000);
 assert.equal(r.byStrategy.find(s=>s.strategy==='BREAKOUT_RETEST').horizons[0].measured,1);
 assert.equal(r.byStrategy.find(s=>s.strategy==='EMA_COMPRESSION').horizons[0].measured,1);
});
test('3/5-day pending and budget exclusions never inflate measured sample',()=>{
 const a=item('3762',[sig('HIGHER_LOW','2026-10-29',100,
  [1000,0,0],['DONE','PENDING','BUDGET_EXCLUDED'])]);
 const b=item('7203',[sig('HIGHER_LOW','2026-10-30',100,
  [-500,0,0],['DONE','BUDGET_EXCLUDED','PENDING'])]);
 const result=run([a,b]),x=result.byStrategy.find(s=>s.strategy==='HIGHER_LOW');
 assert.equal(x.horizons[0].measured,2);
 assert.equal(x.horizons[0].averageProfitYen100,250);
 assert.equal(x.horizons[0].atLeast7000YenPercent,0);
 assert.equal(x.horizons[0].atMostMinus10000YenPercent,0);
 assert.equal(x.horizons[1].measured,0);
 assert.equal(x.horizons[1].pending,1);
 assert.equal(x.horizons[1].budgetExcluded,1);
 assert.equal(x.horizons[1].winRatePercent,null);
 assert.equal(x.horizons[2].pending,1);
 assert.equal(x.horizons[2].budgetExcluded,1);
});
test('mixed date coverage is explicitly blocked: no cherry-picked market window',()=>{
 const a=item('3762'),b=item('7203',[],[],{
  dates:['2026-10-29','2026-10-30','2026-11-02'],
 });
 assert.equal(run([a,b]).status,'BLOCKED_NONCOMPARABLE_STOCK_DATE_COVERAGE');
});
test('duplicate stock files and unknown codes fail closed',()=>{
 const a=item('3762');
 assert.equal(run([a,a]).status,'BLOCKED_INVALID_OR_DUPLICATE_STOCK_CODE');
 assert.equal(run([item('bad')]).status,'BLOCKED_INVALID_OR_DUPLICATE_STOCK_CODE');
});
test('data from financial archives excluded from strict price-only cohort',()=>{
 const a=item('3762',[],[],{financialPages:[{response:{data:[]}}]});
 assert.equal(run([a]).status,'BLOCKED_PRICE_ONLY_COHORT_REQUIRES_SKIP_FINANCIAL');
});
test('outcome discrepancies between 30m and 60m for same stock/day block comparison',()=>{
 const a=item('3762',
  [sig('BREAKOUT_RETEST','2026-10-29',100,[1000,2000,3000])],
  [sig('BREAKOUT_RETEST','2026-10-29',101,[9999,2000,3000])]);
 assert.equal(run([a]).status,'BLOCKED_CROSS_TIMEFRAME_OUTCOME_DISAGREEMENT');
});
test('invalid horizon metrics and uncompleted numeric P&L are blocked',()=>{
 const s=sig('BREAKOUT_RETEST');
 s.outcomes[1].profitYen100=12345;
 assert.equal(run([item('3762',[s])]).status,'BLOCKED_UNCOMPLETED_WITH_RETURN');
 const t=sig('HIGHER_LOW');
 t.outcomes[0].profitYen100=NaN;
 assert.equal(run([item('3762',[t])]).status,'BLOCKED_INVALID_COMPLETED_RETURN');
});
test('no financial-driven quality strategy is invented',()=>{
 const a=item('3762',[sig('QUALITY_PULLBACK')]);
 assert.equal(run([a]).status,'BLOCKED_INVALID_OR_UNSUPPORTED_STRATEGY_SIGNAL');
 const noSignals=run([item('3762')]);
 assert.equal(noSignals.byStrategy.length,3);
 assert.equal(noSignals.uniquePortfolioStockDateSignals,0);
 assert.equal(noSignals.byStrategy[0].horizons[0].winRatePercent,null);
});
test('archive count bound prevents huge or ambiguous cohort imports',()=>{
 assert.equal(run([]).status,'BLOCKED_ARCHIVE_COUNT_OUT_OF_BOUNDS');
 assert.equal(run(Array(MULTI_STOCK_LIMITS.maxArchives+1).fill(item('3762'))).status,
 'BLOCKED_ARCHIVE_COUNT_OUT_OF_BOUNDS');
});
test('CLI rejects duplicate path before read; invalid archive fails with safe code',()=>{
 const tmp=mkdtempSync(join(tmpdir(),'multi-stock-test-'));
 try{
  const path=join(tmp,'private.json');
  writeFileSync(path,JSON.stringify({code:'3762'}));
  assert.throws(()=>runMultiStockFourPatternLocal([path,path]),
   /DUPLICATE_LOCAL_ARCHIVE_PATH/);
  const blocked=runMultiStockFourPatternLocal([path]);
  assert.match(blocked.status,/^BLOCKED_/);
 }finally{rmSync(tmp,{recursive:true,force:true})}
});
test('end-to-end two synthetic independent J-Quants archives stay in shadow mode',()=>{
 const calendarDates=[
  '2026-10-06','2026-10-07','2026-10-08','2026-10-09',
  '2026-10-13','2026-10-14','2026-10-15','2026-10-16',
  '2026-10-19','2026-10-20','2026-10-21','2026-10-22',
  '2026-10-23','2026-10-26','2026-10-27','2026-10-28',
  '2026-10-29','2026-10-30','2026-11-02','2026-11-04',
 ];
 const pg=data=>[{
  requestPaginationKey:null,receivedAt:'2026-11-05T08:00:00Z',
  response:{data},
 }];
 function archive(code){
  const providerCode=code+'0';
  const minuteDays=[],dailyDays=[];
  for(let i=0;i<calendarDates.length;i++){
   const date=calendarDates[i],p=200+i;
   const times=['09:00','09:30','10:00','11:30','12:30','15:30'];
   const rows=times.map((time,j)=>({
    Date:date,Time:time,Code:providerCode,
    O:p,H:p+2,L:p-1,C:j===times.length-1?p+1:p,
    Vo:100,Va:p*100,
   }));
   minuteDays.push({date,pages:pg(rows)});
   dailyDays.push({date,pages:pg([{
    Date:date,Code:providerCode,O:p,H:p+2,L:p-1,C:p+1,Vo:600,
    AdjFactor:1,ExRT:null,
   }])});
  }
  return {code,minuteDays,dailyDays,financialPages:null};
 }
 const r=summarizeMultiStockFourPatternArchives([archive('3762'),archive('7203')]);
 assert.equal(r.status,'MULTI_STOCK_RETROSPECTIVE_SHADOW_ONLY');
 assert.equal(r.stockCount,2);
 assert.equal(r.sameCoverageVerified,true);
 assert.equal(r.verifiedTradeDaysPerStock,20);
 assert.equal(r.originalMinuteBars,240);
 assert.equal(r.priceOnly,true);
 assert.equal(r.byStrategy.length,3);
 assert.equal(r.eligibleForNotifications,false);
 assert.equal(r.eligibleForProduction,false);
 assert.equal(r.researchEvidenceStatus,'NOT_VALIDATED_FOR_TRADING');
});
