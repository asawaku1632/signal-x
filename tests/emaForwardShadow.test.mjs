import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { analyzeEmaCrossovers } from "../app/lib/emaCrossoverBacktest.ts";
import { bollingerEntryAllowed } from "../app/lib/emaSignalComparison.ts";
import { regimeAtBuySignal } from "../app/lib/emaRegimeResearch.ts";
import { planForwardSession, validForwardSession, shouldRunForwardOnHost } from "../app/lib/emaForwardShadowCore.ts";

function bars(closes){
 return closes.map((close,i)=>({time:Date.UTC(2026,2,1)/1000+i*86400,open:close,high:close+3,low:close-3,close,volume:1000}));
}
const full=bars([
 ...Array.from({length:130},(_,i)=>100+i*0.3),
 ...Array.from({length:14},(_,i)=>138.7-(i+1)),
 ...Array.from({length:45},(_,i)=>124.7+(i+1)*0.8),
 ...Array.from({length:50},(_,i)=>160.7-(i+1)*2),
]);
const signalIndex=analyzeEmaCrossovers(full).signals.find(s=>s.kind==="BUY"&&bollingerEntryAllowed(full,s.index)&&regimeAtBuySignal(full,s.index).trend==="UP")?.index;
assert.ok(signalIndex,"synthetic history must have qualified forward signal");
const signal=full.slice(0,signalIndex+1);
const later=full.slice(0,signalIndex+2);
const clock=(bar)=>new Date((bar.time+8*3600)*1000);
function position(strategy,status,override={}){
 return {id:strategy==="TAKE"?1:2,code:"7203",strategy,status,signal_time:signal.at(-1).time,
 signal_close:signal.at(-1).close,entry_time:null,entry_price:null,
 exit_queued_reason:null,exit_queued_time:null,...override};
}
const plan=(candles,lastSeen,trades=[])=>planForwardSession({
 code:"7203",candles,splitEvents:[],lastSeen,trades,halted:false,now:clock(candles.at(-1)),
});

test("initial observation is forward-only and queues two strategies at the actual new signal",()=>{
 const out=plan(signal,null);
 assert.equal(out.kind,"PROCESS");
 assert.deepEqual(out.actions.filter(x=>x.kind==="NEW").map(x=>x.strategy),["TAKE","TIME"]);
 assert.equal(out.actions[0].signalTime,signal.at(-1).time);
 assert.equal(plan(signal,signal.at(-1).time).reason,"ALREADY_PROCESSED");
});

test("nothing starts before 16:15 Japan time or on a stale provider day",()=>{
 const last=signal.at(-1);
 const japanMorning=new Date((last.time-2*3600)*1000); // 07:00 JST
 assert.equal(validForwardSession(japanMorning,last),false);
 assert.equal(validForwardSession(new Date((last.time+8*3600)*1000),last),true);
 assert.equal(validForwardSession(new Date((last.time+32*3600)*1000),last),false);
});

test("following day's opening price is stored; take profit is only from next trading day's high",()=>{
 const p=position("TAKE","PENDING");
 const out=plan(later,signal.at(-1).time,[p]);
 assert.ok(out.actions.some(a=>a.kind==="ENTRY"&&a.price===later.at(-1).open));
 assert.equal(out.actions.some(a=>a.kind==="NEW"),false);
 const touched=later.map(x=>({...x}));
 touched.at(-1).high=touched.at(-1).open*1.16;
 const win=plan(touched,signal.at(-1).time,[p]);
 assert.equal(win.actions.find(a=>a.kind==="CLOSE")?.reason,"TAKE");
 assert.ok(win.actions.find(a=>a.kind==="CLOSE").net<win.actions.find(a=>a.kind==="CLOSE").gross);
});

test("gap in captured market days halts instead of retrospectively filling",()=>{
 const after=full.slice(0,signalIndex+4);
 const out=plan(after,signal.at(-1).time,[position("TIME","PENDING")]);
 assert.equal(out.kind,"HALT");
 assert.equal(out.reason,"MISSED_TRADING_SESSION");
 assert.equal(out.actions.length,0);
});

test("EMA close signal is queued at close and filled only at the next recorded open",()=>{
 const x=later;
 const row=position("TIME","OPEN",{entry_time:signal.at(-1).time,entry_price:100,exit_queued_reason:"EMA",exit_queued_time:signal.at(-1).time});
 const out=plan(x,signal.at(-1).time,[row]);
 const close=out.actions.find(a=>a.kind==="CLOSE");
 assert.equal(close?.reason,"EMA");
 assert.equal(close?.price,x.at(-1).open);
});

test("time rule exits after twenty trading intervals at current opening; no same-day retro order",()=>{
 const newest=full.slice(0,signalIndex+24);
 const lastSeen=newest.at(-2).time;
 const entry=newest.at(-21).time;
 const out=plan(newest,lastSeen,[position("TIME","OPEN",{entry_time:entry,entry_price:newest.at(-21).open})]);
 const close=out.actions.find(a=>a.kind==="CLOSE");
 assert.equal(close?.reason,"TIME");
 assert.equal(close?.price,newest.at(-1).open);
});

test("past splits at first run skip only; splits after tracking starts quarantine",()=>{
 const split=[signal[30].time];
 const fresh=planForwardSession({code:"7203",candles:signal,splitEvents:split,lastSeen:null,halted:false,trades:[],now:clock(signal.at(-1))});
 assert.equal(fresh.kind,"SKIP");
 const existing=planForwardSession({code:"7203",candles:later,splitEvents:split,lastSeen:signal.at(-1).time,halted:false,trades:[],now:clock(later.at(-1))});
 assert.equal(existing.kind,"HALT");
});

test("isolated route and schema must not touch production scoring, notifications or paper trades",()=>{
 const route=readFileSync("app/api/cron/ema-forward-shadow/route.ts","utf8");
 const ui=readFileSync("app/admin/ema-forward/page.tsx","utf8");
 const store=readFileSync("app/lib/emaForwardShadowStore.ts","utf8");
 const schema=readFileSync("sql/ema-forward-shadow-v1.sql","utf8");
 assert.match(route,/requireCronAuth/);
 assert.match(route,/EMA_FORWARD_SHADOW_ENABLED/);
 assert.match(ui,/getAdminSession/);
 assert.match(ui,/if\(!isAdmin\)/);
 assert.match(schema,/ema_forward_shadow_trades/);
 assert.doesNotMatch(route+store+ui,/UPDATE daily_stock_results|INSERT INTO paper_trades|LINE_NOTIFY|sendLine|UPDATE ai_power/i);
});

test("only canonical primary production domain schedules an automatic scan",()=>{
 assert.equal(shouldRunForwardOnHost("signal-x-ppjg.vercel.app",undefined,"production"),true);
 assert.equal(shouldRunForwardOnHost("signal-x-hazel.vercel.app",undefined,"production"),false);
 assert.equal(shouldRunForwardOnHost("signalx-notification-runner.vercel.app",undefined,"production"),false);
 assert.equal(shouldRunForwardOnHost("signal-x-ppjg.vercel.app",undefined,"preview"),false);
 assert.equal(shouldRunForwardOnHost("signal-x-ppjg.vercel.app","0","production"),false);
});
