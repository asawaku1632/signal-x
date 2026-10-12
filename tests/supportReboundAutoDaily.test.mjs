import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  REBOUND_AUTO_REQUEST_LIMIT_PER_DAY,REBOUND_AUTO_STOCKS_PER_BATCH,REBOUND_AUTO_SCHEDULES,
  reboundAutoPreflight,shouldRunReboundOnHost,validReboundDailyInput,
  todayReboundCandidate,progressFrozenRebound,japanDate,
} from "../app/lib/research/supportReboundAutoCore.ts";
import { SUPPORT_REBOUND_RESEARCH_BASKET } from "../app/lib/research/supportReboundUniverse.ts";
import { REBOUND_SCORE_VERSION } from "../app/lib/research/supportReboundRiskScore.ts";
function bars(){
  const t=Date.parse("2026-07-01T06:00:00Z")/1000;
  const a=Array.from({length:70},(_,i)=>({time:t+i*86400,open:104,high:105,low:103,close:104,volume:1000}));
  a[66]={...a[66],open:102,high:103,low:101,close:102};
  a[67]={...a[67],open:100,high:101,low:99,close:100};
  a[68]={...a[68],open:98,high:99,low:97,close:98};
  a[69]={...a[69],open:97,high:98,low:96.5,close:97.2};
  return a;
}
function future(input){
  const a=[...input];const t=a[0].time;
  for(let i=70;i<=75;i++)a.push({time:t+i*86400,open:i===75?105:100,high:i===75?106:101,low:99,close:i===75?105:100,volume:1000});
  return a;
}
test("only 100 curated unique stocks across two fixed, bounded 50-stock batches",()=>{
  assert.equal(SUPPORT_REBOUND_RESEARCH_BASKET.length,100);
  assert.equal(new Set(SUPPORT_REBOUND_RESEARCH_BASKET).size,100);
  assert.equal(REBOUND_AUTO_REQUEST_LIMIT_PER_DAY,100);
  assert.equal(REBOUND_AUTO_STOCKS_PER_BATCH,50);
  assert.deepEqual(REBOUND_AUTO_SCHEDULES,["45 7 * * 1-5","5 8 * * 1-5"]);
});
test("closed-market and holiday fail closed before queries",()=>{
  assert.equal(reboundAutoPreflight(new Date("2026-10-12T07:00:00Z")).reason,"MARKET_CLOSED");
  assert.equal(reboundAutoPreflight(new Date("2026-10-13T07:30:00Z")).reason,"OUTSIDE_CLOSED_MARKET_WINDOW");
  assert.equal(reboundAutoPreflight(new Date("2026-10-13T07:45:00Z")).ok,true);
  assert.equal(reboundAutoPreflight(new Date("2028-10-13T07:45:00Z")).reason,"CALENDAR_UNAVAILABLE");
  assert.equal(shouldRunReboundOnHost("signal-x-ppjg.vercel.app","production"),true);
  assert.equal(shouldRunReboundOnHost("signal-x-ppjg.vercel.app","preview"),false);
  assert.equal(shouldRunReboundOnHost("signalx-notification-runner.vercel.app","production"),false);
});
test("today-only signal, no historical backfill; frozen score uses last known close",()=>{
  const a=bars(),date=japanDate(a[69].time);
  assert.ok(validReboundDailyInput(a));
  const candidate=todayReboundCandidate(a,[],date);
  assert.ok(candidate);
  assert.equal(candidate.signalTime,a[69].time);
  assert.equal(candidate.signalClose,97.2);
  assert.equal(candidate.scoreVersion,REBOUND_SCORE_VERSION);
  assert.equal(todayReboundCandidate(a,[],"2027-01-01"),null);
  assert.equal(todayReboundCandidate(a,[a[45].time],date),null);
  assert.equal(todayReboundCandidate(a.slice(0,59),[],date),null);
});
test("a registered prospective signal enters next session and exits at fifth session, no hindsight",()=>{
  const a=bars(), signal={
    id:3,signalTime:a[69].time,signalClose:a[69].close,scoreVersion:REBOUND_SCORE_VERSION,
    state:"PENDING",entryTime:null,entryPrice:null,
  };
  const pending=progressFrozenRebound(signal,a,[]);
  assert.equal(pending.state,"PENDING");
  assert.equal(pending.returnPercent,null);
  const one=future(a).slice(0,71);
  const open=progressFrozenRebound(signal,one,[]);
  assert.equal(open.state,"OPEN");
  assert.equal(open.entryPrice,100);
  const result=progressFrozenRebound({...signal,state:"OPEN",entryTime:open.entryTime,entryPrice:open.entryPrice},future(a),[]);
  assert.equal(result.state,"CLOSED");
  assert.equal(result.exitPrice,105);
  assert.equal(result.returnPercent,5);
  assert.equal(result.worstIntratradePercent,-1);
});
test("revised signal, entry or forward splits become REVIEW, never fabricated wins",()=>{
  const a=bars(),signal={
    id:4,signalTime:a[69].time,signalClose:a[69].close,scoreVersion:REBOUND_SCORE_VERSION,
    state:"PENDING",entryTime:null,entryPrice:null,
  };
  const revised=future(a);revised[69]={...revised[69],close:97.8};
  assert.equal(progressFrozenRebound(signal,revised,[]).reason,"SIGNAL_CLOSE_REVISED");
  assert.equal(progressFrozenRebound(signal,future(a),[a[69].time+86400*2]).reason,"FORWARD_SPLIT");
  assert.equal(progressFrozenRebound({...signal,entryTime:a[69].time+86400,entryPrice:120},future(a),[]).reason,"ENTRY_OPEN_REVISED");
});
test("cron is bounded, signed, owner-only; DB schema isolated and defaults off",()=>{
  const root=new URL("../",import.meta.url);
  const route=readFileSync(new URL("app/api/cron/rebound-forward/[batch]/route.ts",root),"utf8");
  const runner=readFileSync(new URL("app/lib/research/supportReboundAutoRunner.ts",root),"utf8");
  const sql=readFileSync(new URL("supabase/migrations/20261012_create_rebound_forward_daily.sql",root),"utf8");
  const vercel=JSON.parse(readFileSync(new URL("vercel.json",root),"utf8"));
  const entries=vercel.crons.filter(x=>x.path.startsWith("/api/cron/rebound-forward/"));
  assert.deepEqual(entries,[{path:"/api/cron/rebound-forward/0",schedule:REBOUND_AUTO_SCHEDULES[0]},
    {path:"/api/cron/rebound-forward/1",schedule:REBOUND_AUTO_SCHEDULES[1]}]);
  assert.match(route,/requireCronAuth/);assert.match(route,/shouldRunReboundOnHost/);
  assert.match(route,/reboundAutoPreflight/);assert.match(runner,/rebound_forward_control/);
  assert.match(runner,/ON CONFLICT\(trade_date,batch\) DO NOTHING/);
  assert.match(runner,/MAX_PARALLEL=5/);assert.match(sql,/enabled boolean NOT NULL DEFAULT false/);
  assert.doesNotMatch(runner,/\/api\/line|\/api\/trade|INSERT INTO public\.predictions|UPDATE public\.analysis/);
});
