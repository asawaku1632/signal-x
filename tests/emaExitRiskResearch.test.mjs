import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {backtestEmaCrossovers} from "../app/lib/emaCrossoverBacktest.ts";
import {bollingerEntryAllowed} from "../app/lib/emaSignalComparison.ts";
import {regimeAtBuySignal,inPhase} from "../app/lib/emaRegimeResearch.ts";
import {computeStage5Stock} from "../app/lib/emaStage5Research.ts";
import {EMA_EXIT_IDS,simulateEmaExits,exitResearchSummary,analyzeExitStock} from "../app/lib/emaExitRiskResearch.ts";

const start=Date.parse("2025-03-01T00:00:00Z")/1000;
function bars(closes){
 return closes.map((close,i)=>({time:start+i*86400,open:close,high:close+2,low:close-2,close,volume:1000}));
}
const sample=()=>bars([...Array(100).fill(100),
 ...Array.from({length:40},(_,i)=>101+i*3), ...Array.from({length:40},(_,i)=>221-i*4),
 ...Array.from({length:45},(_,i)=>65+i*5), ...Array.from({length:40},(_,i)=>290-i*6)]);

function syntheticSignalBars(){
 const x=sample();
 const stage5=computeStage5Stock({code:"7203",candles:x});
 assert.ok(stage5.trades.BB_UP.length>0);
 return x;
}

test("stage6 EMA baseline equals stage5 BB+UP when costs are zero",()=>{
 const b=syntheticSignalBars();
 const out=simulateEmaExits("7203",b,"EMA",0);
 const old=computeStage5Stock({code:"7203",candles:b}).trades.BB_UP;
 assert.deepEqual(out.trades.map(t=>[t.entryTime,t.exitTime,t.grossPnlYen]),
   old.map(t=>[t.entryTime,t.exitTime,t.pnlYen]));
 assert.deepEqual(EMA_EXIT_IDS,["EMA","STOP","TAKE","TIME"]);
});

test("risk exits never change original buy signals and are no earlier than next open",()=>{
 const b=syntheticSignalBars();
 const old=computeStage5Stock({code:"7203",candles:b}).trades.BB_UP;
 for(const rule of EMA_EXIT_IDS){
  const result=simulateEmaExits("7203",b,rule,0.0015);
  for(const t of result.trades){
   assert.ok(b.findIndex(x=>x.time===t.entryTime)>b.findIndex(x=>x.time===t.buySignalTime));
   assert.ok(old.some(v=>v.entryTime===t.entryTime));
   assert.ok(t.exitTime>=t.entryTime);
   assert.ok(t.frictionYen>0);
  }
 }
});

test("stop gap fill uses actual worse open; inside-bar stop exits at threshold",()=>{
 const b=syntheticSignalBars();
 const entry=computeStage5Stock({code:"7203",candles:b}).trades.BB_UP[0];
 const j=b.findIndex(x=>x.time===entry.entryTime);
 const gap=b.map(x=>({...x}));
 const stop=entry.entryPrice*0.93;
 gap[j+1].open=stop-5;gap[j+1].low=stop-8;gap[j+1].high=stop+4;gap[j+1].close=stop-4;
 const result=simulateEmaExits("7203",gap,"STOP",0);
 assert.equal(result.trades[0].reason,"STOP");
 assert.equal(result.trades[0].exitPrice,gap[j+1].open);
 const intra=b.map(x=>({...x}));
 intra[j+1].low=stop-1;
 const hits=simulateEmaExits("7203",intra,"STOP",0);
 assert.equal(hits.trades[0].exitPrice,stop);
});

test("take profit fills at intraday target unless opens already above target",()=>{
 const b=syntheticSignalBars();
 const entry=computeStage5Stock({code:"7203",candles:b}).trades.BB_UP[0];
 const j=b.findIndex(x=>x.time===entry.entryTime);
 const price=entry.entryPrice*1.15;
 const a=b.map(x=>({...x}));
 a[j+1].high=price+2;
 const one=simulateEmaExits("7203",a,"TAKE",0);
 assert.equal(one.trades[0].reason,"TAKE");
 assert.equal(one.trades[0].exitPrice,price);
 const g=b.map(x=>({...x}));
 g[j+1].open=price+5;g[j+1].high=price+8;g[j+1].low=price-3;g[j+1].close=price+2;
 const two=simulateEmaExits("7203",g,"TAKE",0);
 assert.equal(two.trades[0].exitPrice,price+5);
});

test("20 trading session cap uses opening price, never the future day's close",()=>{
 const b=syntheticSignalBars();
 const entry=computeStage5Stock({code:"7203",candles:b}).trades.BB_UP[0];
 const j=b.findIndex(x=>x.time===entry.entryTime);
 const x=simulateEmaExits("7203",b,"TIME",0);
 const t=x.trades[0];
 assert.equal(t.reason,"TIME");
 assert.equal(t.exitTime,b[j+20].time);
 assert.equal(t.exitPrice,b[j+20].open);
 assert.equal(t.holdBars,20);
});

test("fee+slippage model reduces net return and can turn break-even into loss",()=>{
 const b=syntheticSignalBars();
 const no=simulateEmaExits("7203",b,"EMA",0).trades;
 const fees=simulateEmaExits("7203",b,"EMA",0.0015).trades;
 assert.equal(no.length,fees.length);
 assert.ok(fees.every((t,i)=>t.pnlYen<no[i].pnlYen));
 for(let i=0;i<no.length;i++){
  assert.ok(Math.abs(fees[i].pnlYen+fees[i].frictionYen-no[i].pnlYen)<0.01);
 }
});

test("no future leakage for exit entry signal; close-time feature is stable",()=>{
 const b=syntheticSignalBars();
 const i=130;
 const original=bollingerEntryAllowed(b,i);
 const trend=regimeAtBuySignal(b,i);
 const extended=[...b,...bars(Array(25).fill(99999)).map((x,j)=>({...x,time:b.at(-1).time+(j+1)*86400}))];
 assert.equal(bollingerEntryAllowed(extended,i),original);
 assert.deepEqual(regimeAtBuySignal(extended,i),trend);
});

test("quarantine stock splits, invalid high/low and maintain phase partition",()=>{
 const b=syntheticSignalBars();
 const split=analyzeExitStock({code:"9984",candles:b,splitEvents:[b[130].time]});
 assert.ok(split.reason?.includes("分割"));
 assert.equal(split.trades.EMA.length,0);
 const invalid=b.map(x=>({...x}));invalid[20].high=invalid[20].low-1;
 assert.ok(analyzeExitStock({code:"7203",candles:invalid}).reason?.includes("高値"));
 const summary=exitResearchSummary([{code:"7203",candles:b},{code:"9984",candles:b,splitEvents:[b[130].time]}],"ALL");
 assert.equal(summary.eligible,1);assert.equal(summary.excluded,1);
 for(const id of EMA_EXIT_IDS){
  const clean=summary.stocks[0].trades[id];
  const all=clean.length,train=clean.filter(t=>inPhase(t,"TRAIN")).length,post=clean.filter(t=>inPhase(t,"TEST")).length;
  assert.ok(all>=train+post);
  assert.equal(summary.summaries[id].stats.trades,all);
 }
});

test("admin gating and side-effect free research",()=>{
 const p=readFileSync("app/admin/ema-stage6/page.tsx","utf8");
 const ui=readFileSync("app/admin/ema-stage6/EmaExitClient.tsx","utf8");
 const e=readFileSync("app/lib/emaExitRiskResearch.ts","utf8");
 assert.match(p,/getAdminSession/);assert.match(p,/if \(!isAdmin\)/);
 assert.match(ui,/\/api\/admin\/ema-signals/);
 assert.match(ui,/研究を開始/);
 assert.doesNotMatch(ui+e+p,/pool\.query|INSERT INTO|UPDATE public|DELETE FROM|sendNotification|sendLine|saveDisplaySnapshot/i);
});
