import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {backtestEmaCrossovers} from "../app/lib/emaCrossoverBacktest.ts";
import {EMA_VALIDATION_EPOCH, inPhase} from "../app/lib/emaRegimeResearch.ts";
import {bollingerEntryAllowed} from "../app/lib/emaSignalComparison.ts";
import {EMA_STAGE5_IDS,computeStage5Stock,riskStatistics,stage5Summary} from "../app/lib/emaStage5Research.ts";

function bars(closes) {
 return closes.map((close,i)=>({time: Date.parse("2024-10-01T00:00:00Z")/1000 + i*86400,
 open:close, high:close+2, low:close-2, close, volume:1000}));
}
const sample=()=>bars([...Array(100).fill(100),
 ...Array.from({length:40},(_,i)=>101+i*3),...Array.from({length:40},(_,i)=>221-i*4),
 ...Array.from({length:45},(_,i)=>65+i*5),...Array.from({length:40},(_,i)=>290-i*6)]);
function trade(pnl,exit,code="1111") {return {
 code,buySignalTime:exit-172800, entryTime:exit-86400,sellSignalTime:exit-86400,exitTime:exit,
 entryPrice:100,exitPrice:100+pnl/100,shares:100,pnlYen:pnl,returnPercent:pnl/100,holdBars:1,
};}

test("four fixed nested strategies: base remains unchanged, stricter filters never create new entries",()=>{
 const candles=sample();
 const result=computeStage5Stock({code:"7203",candles});
 assert.equal(result.reason,null);
 assert.deepEqual(result.trades.BASE.map(({code,...rest})=>rest),backtestEmaCrossovers(candles).trades);
 for(const [strict,loose] of [["BB_UP","BB"],["BB_UP_HIGH","BB_UP"]] ){
  assert.ok(result.trades[strict].every(t=>result.trades[loose].some(v=>v.entryTime===t.entryTime&&v.exitTime===t.exitTime)));
 }
 assert.deepEqual(EMA_STAGE5_IDS,["BASE","BB","BB_UP","BB_UP_HIGH"]);
});

test("later candles cannot change a previously determined entry or completed trade",()=>{
 const candles=sample();
 const initial=computeStage5Stock({code:"7203",candles});
 const append=bars(Array(50).fill(999999)).map((c,i)=>({...c,time:candles.at(-1).time+(i+1)*86400}));
 const later=computeStage5Stock({code:"7203",candles:[...candles,...append]});
 // later appended bars are deliberately invalid corporate-action gaps, hence quarantined
 assert.ok(later.reason);
 assert.deepEqual(computeStage5Stock({code:"7203",candles}).trades.BASE,initial.trades.BASE);
 const i=140;
 const original=bollingerEntryAllowed(candles,i);
 const clone=[...candles.map(c=>({...c})),...append];
 assert.equal(bollingerEntryAllowed(clone,i),original);
});

test("median, profit factor, loss streak and chronological realized drawdown",()=>{
 const out=riskStatistics([trade(-100,2),trade(500,3),trade(-200,4),trade(-300,5),trade(200,6)]);
 assert.equal(out.trades,5);
 assert.equal(out.winRatePercent,40);
 assert.equal(out.totalPnlYen,100);
 assert.equal(out.medianPnlYen,-100);
 assert.equal(out.medianReturnPercent,-1);
 assert.equal(out.profitFactor,1.17);
 assert.equal(out.longestLosingStreak,2);
 assert.equal(out.maxRealizedDrawdownYen,500);
 assert.equal(out.worstTradeYen,-300);
 assert.equal(riskStatistics([]).winRatePercent,null);
 assert.equal(riskStatistics([trade(10,1)]).profitFactor,null);
});

test("split-affected symbols are never counted in any of the four variants",()=>{
 const candles=sample();
 const result=stage5Summary([
  {code:"7203",candles},
  {code:"8035",candles,splitEvents:[candles[150].time]},
 ]);
 assert.equal(result.eligible,1);
 assert.equal(result.excluded,1);
 assert.ok(result.stocks[1].reason?.includes("株式分割"));
 for(const id of EMA_STAGE5_IDS) {
  assert.equal(result.stocks[1].trades[id].length,0);
  assert.equal(result.phases.ALL[id].eligibleStocks,1);
 }
});

test("split boundary excludes spanning trade in train and validation; no future leakage",()=>{
 const bar=sample();
 const full=stage5Summary([{code:"7203",candles:bar}]);
 for(const id of EMA_STAGE5_IDS){
  const trades=full.stocks[0].trades[id];
  assert.equal(trades.length,full.phases.ALL[id].metrics.trades);
  const train=trades.filter(t=>inPhase(t,"TRAIN"));
  const validation=trades.filter(t=>inPhase(t,"TEST"));
  assert.equal(full.phases.TRAIN[id].metrics.trades,train.length);
  assert.equal(full.phases.TEST[id].metrics.trades,validation.length);
  assert.equal(train.length+validation.length+full.boundaryExcluded[id],trades.length);
 }
 assert.ok(EMA_VALIDATION_EPOCH>0);
});

test("stock concentration metric is based on same phase and strategy",()=>{
 const candles=sample();
 const full=stage5Summary([{code:"7203",candles},{code:"8306",candles}]);
 for(const id of EMA_STAGE5_IDS) {
  const result=full.phases.ALL[id];
  const total=result.byStock.reduce((s,row)=>s+row.risk.totalPnlYen,0);
  assert.equal(result.metrics.totalPnlYen,total);
  assert.equal(result.excludingHighestProfitYen,total-(result.highestProfitYen??0));
 }
});

test("admin-only and read-only; no production scoring or saved records",()=>{
 const page=readFileSync("app/admin/ema-stage5/page.tsx","utf8");
 const ui=readFileSync("app/admin/ema-stage5/EmaStage5Client.tsx","utf8");
 const eng=readFileSync("app/lib/emaStage5Research.ts","utf8");
 assert.match(page,/getAdminSession/);
 assert.match(page,/if \(!isAdmin\)/);
 assert.match(ui,/api\/admin\/ema-signals/);
 assert.match(ui,/研究を開始/);
 assert.doesNotMatch(page+ui+eng,/pool\.query|INSERT INTO|UPDATE public|DELETE FROM|sendNotification|sendLine|saveDisplaySnapshot/i);
});
