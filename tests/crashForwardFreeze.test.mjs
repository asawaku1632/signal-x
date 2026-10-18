import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 captureFrozenCrash,evaluateFrozenCandidates,shouldRunCrashForwardOnHost,
 CRASH_FORWARD_VERSION,
} from "../app/lib/research/crashForwardCore.mjs";

const date="2026-10-15";
const now=new Date("2026-10-15T07:55:00.000Z"); // 16:55 JST
const session=[
 {date:"2026-10-14",nikkei:100},
 {date:"2026-10-15",nikkei:95},
 {date:"2026-10-16",nikkei:98},
];
function rows(includeNext=true){
 const result=[];
 for(let j=0;j<800;j++){
  const code=String(2000+j);
  const prev=100;
  const close=j===0?101:j===1?90:100;
  const next=j===0?102:j===1?115:100;
  result.push({date:"2026-10-14",code,name:"Research"+code,price:prev});
  result.push({date,code,name:"Research"+code,price:close});
  if(includeNext)result.push({date:"2026-10-16",code,name:"Research"+code,price:next});
 }
 return result;
}
test("only a crash's same-day settled post-close timestamp freezes immutable cohort",()=>{
 const decision=captureFrozenCrash({marketRows:session,priceRows:rows(),now});
 assert.equal(decision.status,"READY");
 assert.equal(decision.version,CRASH_FORWARD_VERSION);
 assert.equal(decision.benchmarkReturn,-5);
 assert.equal(decision.comparableCount,800);
 assert.equal(decision.groups.RESISTANCE.length,20);
 assert.equal(decision.groups.RESISTANCE[0].code,"2000");
 assert.equal(decision.groups.REBOUND_WATCH[0].code,"2001");
 assert.equal(decision.groups.REBOUND_WATCH[0].dailyReturn,-10);
 assert.equal(decision.groups.REBOUND_WATCH[0].relativeReturn,-5);
 assert.equal(decision.groups.RESISTANCE[0].rank,1);
 const premature=captureFrozenCrash({marketRows:session,priceRows:rows(),now:new Date("2026-10-15T05:00:00Z")});
 assert.equal(premature.reason,"OUTSIDE_SETTLED_SESSION_WINDOW");
 const late=captureFrozenCrash({marketRows:session,priceRows:rows(),now:new Date("2026-10-16T07:55:00Z")});
 assert.equal(late.reason,"NOT_MARKET_CRASH"); // 16th has a real index bar, without a crash
});
test("calm markets and incomplete snapshots cannot create forward signals",()=>{
 assert.equal(captureFrozenCrash({
   marketRows:session.map((s,i)=>({...s,nikkei:[100,99,101][i]})),
   priceRows:rows(),now
 }).reason,"NOT_MARKET_CRASH");
 assert.equal(captureFrozenCrash({
   marketRows:session,priceRows:rows().filter(r=>r.date!==date||r.code!=="2001")
     .filter(r=>r.date!==date||r.code!=="2002"),now
 }).reason,"INCOMPLETE_STOCK_SNAPSHOT");
 assert.equal(captureFrozenCrash({
   marketRows:session.filter(r=>r.date!==date),priceRows:rows(),now
 }).reason,"NO_TODAY_SETTLED_INDEX_BAR");
});
test("next-session outcomes use frozen prices and same index date, NOT a later stock snapshot",()=>{
 const capture=captureFrozenCrash({marketRows:session,priceRows:rows(),now});
 const evald=evaluateFrozenCandidates({snapshot:capture,marketRows:session,
   priceRows:rows(),asOfDate:"2026-10-16"});
 assert.equal(evald.status,"READY");
 assert.equal(evald.nextSessionDate,"2026-10-16");
 assert.equal(evald.outcomes.find(x=>x.code==="2001").status,"OBSERVED");
 assert.equal(evald.outcomes.find(x=>x.code==="2001").return1,27.7778);
 assert.equal(evald.outcomes.find(x=>x.code==="2000").return1,0.9901);
 const pending=evaluateFrozenCandidates({snapshot:capture,marketRows:session,
   priceRows:rows(),asOfDate:date});
 assert.equal(pending.reason,"FUTURE_NEXT_SESSION");
 const noStock=evaluateFrozenCandidates({snapshot:capture,marketRows:session,
   priceRows:rows(false),asOfDate:"2026-10-17"});
 assert.equal(noStock.reason,"NEXT_STOCK_SNAPSHOT_INCOMPLETE");
});
test("a skipped index session or outlier requires conservative pending/review outcomes",()=>{
 const capture=captureFrozenCrash({marketRows:session,priceRows:rows(),now});
 const noIndex=evaluateFrozenCandidates({snapshot:capture,
   marketRows:session.slice(0,2),priceRows:rows(),asOfDate:"2026-10-17"});
 assert.equal(noIndex.reason,"NEXT_INDEX_SESSION_UNAVAILABLE");
 const extreme=rows().map(r=>r.date==="2026-10-16"&&r.code==="2001"?{...r,price:999}:r);
 const evaluation=evaluateFrozenCandidates({snapshot:capture,
   marketRows:session,priceRows:extreme,asOfDate:"2026-10-16"});
 const item=evaluation.outcomes.find(x=>x.code==="2001");
 assert.equal(item.status,"REVIEW_PRICE_JUMP");
 assert.equal(item.beatMarket,null);
});
test("production host scope and owner authorization protect independent cron and new page",()=>{
 assert.equal(shouldRunCrashForwardOnHost("signal-x-ppjg.vercel.app","production"),true);
 assert.equal(shouldRunCrashForwardOnHost("signal-x-ppjg-123-signalx-runner-v2-trial2.vercel.app","production"),true);
 assert.equal(shouldRunCrashForwardOnHost("signal-x-ppjg.vercel.app","preview"),false);
 assert.equal(shouldRunCrashForwardOnHost("signalx-notification-runner.vercel.app","production"),false);
 const route=readFileSync(new URL("../app/api/cron/crash-forward-research/route.ts",import.meta.url),"utf8");
 const page=readFileSync(new URL("../app/admin/crash-strength/forward/page.tsx",import.meta.url),"utf8");
 const runner=readFileSync(new URL("../app/lib/research/crashForwardRunner.ts",import.meta.url),"utf8");
 assert.ok(route.indexOf("requireCronAuth(request)")<route.indexOf("runCrashForwardDaily()"));
 assert.match(route,/CRASH_FORWARD_AUTO_ENABLED/);
 assert.ok(page.indexOf("if(!isOwner)notFound()")<page.indexOf("pool.query<Event>"));
 assert.match(runner,/ON CONFLICT \(trade_date\) DO NOTHING/);
 assert.match(runner,/ON CONFLICT \(candidate_id\) DO NOTHING/);
 assert.match(runner,/ROLLBACK/);
 assert.doesNotMatch(route+runner,/sendLine|placeOrder|buyStock|sellStock|UPDATE public\.daily_stock_results/);
});
