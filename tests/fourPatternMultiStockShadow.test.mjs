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
 const s=sig('BREAKOUT_RETEST','2026-10-29',100,[1000,2000,3000],
  ['DONE','PENDING','PENDING']);
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

test('portfolio policy audit explains suppression without selecting by realized return',()=>{
 const a=item('3762',[
  sig('BREAKOUT_RETEST','2026-10-29',500,[50000,70000,0]),
  sig('EMA_COMPRESSION','2026-10-29',250,[15000,20000,0]),
  sig('HIGHER_LOW','2026-10-29',100,[-12000,-22000,0]),
 ]);
 const r=run([a]),a1=r.portfolioSelectionAudit;
 assert.equal(r.status,'SINGLE_STOCK_PILOT_SHADOW_ONLY');
 assert.equal(a1.policy,'EARLIEST_CLOSED_SIGNAL_PER_STOCK_DATE_NOT_MAXIMUM_PROFIT');
 assert.equal(a1.uniqueStockDates,1);
 assert.equal(a1.overlappingStockDates,1);
 assert.equal(a1.selectedByStrategy.HIGHER_LOW,1);
 assert.equal(a1.selectedByStrategy.EMA_COMPRESSION,0);
 assert.equal(a1.selectedByStrategy.BREAKOUT_RETEST,0);
 assert.equal(a1.excludedByStrategy.EMA_COMPRESSION,1);
 assert.equal(a1.excludedByStrategy.BREAKOUT_RETEST,1);
 assert.equal(a1.excludedStrategyGivenSelected.HIGHER_LOW.EMA_COMPRESSION,1);
 assert.equal(a1.excludedStrategyGivenSelected.HIGHER_LOW.BREAKOUT_RETEST,1);
 assert.equal(r.portfolioByTradingDay[0].averageProfitYen100,-12000);
 assert.equal(r.byStrategy.find(s=>s.strategy==='BREAKOUT_RETEST').horizons[0].averageProfitYen100,50000);
 assert.equal(a1.deliberatelyNotReturnOptimized,true);
 assert.equal(r.canTriggerTrade,false);
});
test('per-stock attribution preserves every method despite earliest-method portfolio suppression',()=>{
 const a=item('3762',[
  sig('EMA_COMPRESSION','2026-10-29',90,[2807,25784,-7184]),
  sig('HIGHER_LOW','2026-10-29',80,[-500,-2000,-7000]),
 ]);
 const b=item('7203',[
  sig('EMA_COMPRESSION','2026-10-29',200,[-3017,-2317,-4914]),
  sig('HIGHER_LOW','2026-10-30',70,[1000,0,0],['DONE','PENDING','PENDING']),
 ]);
 const c=item('7752',[
  sig('EMA_COMPRESSION','2026-10-29',200,[180,1879,-4914]),
 ]);
 const r=run([c,a,b]);
 assert.equal(r.stockCount,3);
 assert.deepEqual(r.byStock.map(s=>s.code),['3762','7203','7752']);
 assert.deepEqual(r.byStock.map(s=>s.uniqueStockDateStrategySignals),[2,2,1]);
 const ema=r.byStrategy.find(s=>s.strategy==='EMA_COMPRESSION');
 assert.equal(ema.horizons[1].measured,3);
 assert.equal(ema.horizons[1].averageProfitYen100,8449);
 assert.equal(ema.horizons[1].medianProfitYen100,1879);
 const one=r.byStock[0].byStrategy.find(s=>s.strategy==='EMA_COMPRESSION');
 assert.equal(one.signals,1);
 assert.equal(one.horizons[1].averageProfitYen100,25784);
 const two=r.byStock[1].byStrategy.find(s=>s.strategy==='EMA_COMPRESSION');
 assert.equal(two.horizons[1].averageProfitYen100,-2317);
 const three=r.byStock[2].byStrategy.find(s=>s.strategy==='EMA_COMPRESSION');
 assert.equal(three.horizons[1].averageProfitYen100,1879);
 assert.equal(r.portfolioSelectionAudit.overlappingStockDates,1);
 assert.equal(r.portfolioSelectionAudit.excludedByStrategy.EMA_COMPRESSION,1);
 assert.equal(r.portfolioSelectionAudit.selectedByStrategy.HIGHER_LOW,2);
 assert.equal(r.byStock[1].portfolioByTradingDay[1].pending,1);
 assert.equal(r.byStock[1].portfolioByTradingDay[1].measured,1);
 assert.equal(r.eligibleForProduction,false);
});
test('attribution and earliest-candle selection are invariant to file ordering',()=>{
 const a=item('3762',[
  sig('HIGHER_LOW','2026-10-29',99,[100,0,0]),
  sig('EMA_COMPRESSION','2026-10-29',80,[1500,0,0]),
 ]);
 const b=item('7203',[sig('BREAKOUT_RETEST','2026-10-30',120,[-100,0,0])]);
 const first=run([a,b]),second=run([b,a]);
 assert.deepEqual(first.byStock,second.byStock);
 assert.deepEqual(first.portfolioSelectionAudit,second.portfolioSelectionAudit);
 assert.deepEqual(first.portfolioByTradingDay,second.portfolioByTradingDay);
});
test('stock and portfolio attribution remain empty, null-safe with zero discovered signals',()=>{
 const r=run([item('7203'),item('3762')]);
 assert.equal(r.portfolioSelectionAudit.uniqueStockDates,0);
 assert.equal(r.portfolioSelectionAudit.overlappingStockDates,0);
 assert.deepEqual(r.portfolioSelectionAudit.selectedByStrategy,{
  BREAKOUT_RETEST:0,EMA_COMPRESSION:0,HIGHER_LOW:0,
 });
 assert.equal(r.byStock.length,2);
 assert.equal(r.byStock[0].byStrategy[0].horizons[2].winRatePercent,null);
 assert.equal(r.byStock[0].portfolioByTradingDay[2].measured,0);
 assert.equal(r.researchEvidenceStatus,'NOT_VALIDATED_FOR_TRADING');
});

test('in-sample LOSO shows EMA 3-day mean flips below zero when code 3762 is omitted',()=>{
 const set=[
  item('3762',[sig('EMA_COMPRESSION','2026-10-29',100,[2807,25784,-7184],['DONE','DONE','DONE'])]),
  item('7203',[sig('EMA_COMPRESSION','2026-10-29',100,[-3017,-2317,-4914],['DONE','DONE','DONE'])]),
  item('7752',[sig('EMA_COMPRESSION','2026-10-29',100,[180,1879,-4914],['DONE','DONE','DONE'])]),
 ];
 const result=run(set);
 assert.equal(result.status,'MULTI_STOCK_RETROSPECTIVE_SHADOW_ONLY');
 const loso=result.leaveOneStockOut;
 assert.equal(loso.status,'DESCRIPTIVE_LOSO_COMPLETE');
 assert.equal(loso.promotionEligible,false);
 assert.deepEqual(loso.outcomes.map(x=>x.omittedCode),['3762','7203','7752']);
 const at=(excluded,horizon=3)=>loso.outcomes.find(x=>x.omittedCode===excluded)
  .byStrategy.find(x=>x.strategy==='EMA_COMPRESSION').horizons
  .find(x=>x.tradingDays===horizon);
 assert.equal(at('3762').measured,2);
 assert.equal(at('3762').averageProfitYen100,-219);
 assert.equal(at('7203').averageProfitYen100,13832);
 assert.equal(at('7752').averageProfitYen100,11734);
 assert.equal(result.byStrategy.find(x=>x.strategy==='EMA_COMPRESSION')
  .horizons[1].averageProfitYen100,8449);
 assert.equal(at('3762',5).measured,2);
 assert.equal(at('3762',5).pending,0);
 assert.equal(loso.outcomes[0].portfolioByTradingDay.length,3);
 assert.equal(result.canTriggerTrade,false);
});
test('LOSO with less than 3 independent symbols is not misrepresented',()=>{
 const one=run([item('3762')]);
 assert.equal(one.leaveOneStockOut.status,'INSUFFICIENT_STOCKS_FOR_LOSO');
 assert.deepEqual(one.leaveOneStockOut.outcomes,[]);
 const two=run([item('3762'),item('7203')]);
 assert.equal(two.leaveOneStockOut.status,'INSUFFICIENT_STOCKS_FOR_LOSO');
 assert.deepEqual(two.leaveOneStockOut.outcomes,[]);
});
test('LOSO method and portfolio outputs remain invariant under archive order',()=>{
 const set=[
 item('7752',[sig('HIGHER_LOW','2026-10-30',130,[500,1200,0])]),
 item('3762',[sig('EMA_COMPRESSION','2026-10-29',110,[1000,2000,0])]),
 item('7203',[sig('BREAKOUT_RETEST','2026-10-29',90,[-800,-900,0])]),
 ];
 const a=run(set),b=run([...set].reverse());
 assert.deepEqual(a.leaveOneStockOut,b.leaveOneStockOut);
 assert.equal(a.leaveOneStockOut.outcomes.length,3);
});
test('LOSO treats PENDING and budget exclusions as unmeasured, not zero-profit wins',()=>{
 const set=[
 item('7752',[sig('HIGHER_LOW','2026-10-30',130,[500,0,0],['DONE','PENDING','PENDING'])]),
 item('3762',[sig('HIGHER_LOW','2026-10-29',110,[1000,0,0],['DONE','BUDGET_EXCLUDED','PENDING'])]),
 item('7203',[sig('HIGHER_LOW','2026-10-29',90,[-800,0,0],['DONE','PENDING','BUDGET_EXCLUDED'])]),
 ];
 const result=run(set);
 const sub=result.leaveOneStockOut.outcomes.find(x=>x.omittedCode==='3762');
 const at3=sub.byStrategy.find(x=>x.strategy==='HIGHER_LOW').horizons[1];
 assert.equal(at3.measured,0);
 assert.equal(at3.pending,2);
 assert.equal(at3.winRatePercent,null);
 assert.equal(at3.averageProfitYen100,null);
});
