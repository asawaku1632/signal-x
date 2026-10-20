import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 ALLSTAR_POLICY,STUDIES,WAITING_STUDIES,DISCOVERY_END,CONFIRMATION_FROM,
 evaluateResearchAllStars,normaliseDaily,qualifyCandidate,qualifyConfirmation
} from "../app/lib/research/researchAllStars.mjs";
const date=(month,day)=>`2026-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
const signal=(trade_date,study_key="MM_V1",n=5,performance=2,benchmark=0.3,
  opts={})=>({
 study_key,trade_date,total:n,completed:n,up_count:n,
 deep_loss_count:0,avg_return:String(performance),
 worst_return:String(performance),codes:Array.from({length:n},(_,i)=>
   String(1000+Number(trade_date.slice(-2))*n+i)),
 benchmark_total:950,benchmark_completed:950,
 benchmark_average:String(benchmark),...opts
});
const chosen=key=>rows=>evaluateResearchAllStars(rows).find(x=>x.key===key);

test("eight distinct preregistered sources; in-sample replay catalogue never certified",()=>{
 assert.equal(ALLSTAR_POLICY,"ALLSTAR_FIVE_DAY_COHORT_V1");
 assert.equal(STUDIES.length,8);
 assert.equal(new Set(STUDIES.map(s=>s.key)).size,8);
 assert.ok(STUDIES.every(s=>s.href.startsWith("/")));
 assert.ok(WAITING_STUDIES.some(x=>x.href==="/admin/exit-timing-study"));
 assert.ok(WAITING_STUDIES.some(x=>x.href==="/admin/weak-ai-rebound"));
 assert.equal(DISCOVERY_END,"2026-11-30");
 assert.equal(CONFIRMATION_FROM,"2026-12-01");
});
test("empty sources show zero selected and honest unfulfilled conditions",()=>{
 const results=evaluateResearchAllStars([]);
 assert.equal(results.length,8);
 assert.equal(results.filter(s=>s.status==="ALL_STAR").length,0);
 assert.equal(results.filter(s=>s.status==="CONFIRMING").length,0);
 assert.equal(results[0].discovery.cases,0);
 assert.equal(results[0].discovery.positiveRate,null);
 assert.ok(results[0].unmet.length>0);
});
test("frozen pre-December discovery does not select with fewer than 10 dates",()=>{
 const rows=Array.from({length:9},(_,i)=>signal(date(i<4?10:11,2+i),
  "MM_V1",30,2));
 const r=chosen("MM_V1")(rows);
 assert.equal(r.status,"COLLECTING");
 assert.ok(r.unmet.some(x=>x.includes("10日")));
});
test("candidate needs distinct symbols/months/qualified market coverage not only high win rate",()=>{
 const rows=Array.from({length:10},(_,i)=>signal(date(10,i+1),"MM_V1",10,7,0));
 const r=chosen("MM_V1")(rows);
 assert.equal(r.status,"COLLECTING");
 assert.ok(r.unmet.some(x=>x.includes("2か月")));
 const poorBenchmark=rows.map(x=>({...x,benchmark_completed:500}));
 const r2=chosen("MM_V1")(poorBenchmark);
 assert.equal(r2.discovery.cases,0);
 assert.equal(r2.discovery.excludedDueToBenchmark,10);
});
test("first stage can pass but cannot become ALL_STAR before unseen December evidence",()=>{
 const train=Array.from({length:12},(_,i)=>signal(date(i<6?10:11,i%6+1),
 "HAP_V1",5,2,0.3));
 const s=chosen("HAP_V1")(train);
 assert.equal(s.status,"CONFIRMING");
 assert.equal(s.discovery.cases,60);
 assert.equal(s.discovery.days,12);
 assert.equal(s.confirmation.days,0);
 assert.ok(s.unmet.some(x=>x.includes("12月")));
});
test("truly independent Dec observations confirm selection without editing historic scores",()=>{
 const train=Array.from({length:12},(_,i)=>signal(date(i<6?10:11,i%6+1),
 "HAP_V1",5,2,0.3));
 const after=Array.from({length:10},(_,i)=>signal(date(12,i+1),"HAP_V1",4,1.2,0.4));
 const s=chosen("HAP_V1")([...train,...after]);
 assert.equal(s.status,"ALL_STAR");
 assert.deepEqual(s.unmet,[]);
 assert.equal(s.confirmation.days,10);
 assert.equal(s.confirmation.cases,40);
 assert.ok(s.confirmation.relativeToUniverse>0);
});
test("strong discovery but poor confirmation never promotes",()=>{
 const train=Array.from({length:12},(_,i)=>signal(date(i<6?10:11,i%6+1),
 "MM_V1",5,2,0.3));
 const after=Array.from({length:10},(_,i)=>signal(date(12,i+1),
 "MM_V1",5,-4,0.3,{up_count:0,deep_loss_count:0}));
 const s=chosen("MM_V1")([...train,...after]);
 assert.equal(s.status,"CONFIRMING");
 assert.ok(s.unmet.some(x=>x.includes("別期間")));
});
test("mean does not reward a small winning day over many losing stock-days",()=>{
 const rows=[
 signal(date(10,1),"AIR_V1",100,-3,0,{up_count:0,deep_loss_count:0}),
 signal(date(10,2),"AIR_V1",5,60,0),
 ];
 const s=chosen("AIR_V1")(rows);
 assert.equal(s.discovery.cases,105);
 assert.equal(s.discovery.positiveRate,4.762);
 assert.equal(s.discovery.average5,0);
 assert.equal(s.discovery.relativeToUniverse,28.5);
 assert.equal(s.status,"COLLECTING");
});
test("bad-loss proportion vetoes inflated profitability and win rate",()=>{
 const rows=Array.from({length:12},(_,i)=>signal(date(i<6?10:11,i%6+1),
 "AIR_V1",10,4,0,{up_count:8,deep_loss_count:3}));
 const s=chosen("AIR_V1")(rows);
 assert.equal(s.discovery.cases,120);
 assert.equal(s.discovery.positiveRate,80);
 assert.equal(s.discovery.severeLossRate,30);
 assert.ok(qualifyCandidate(s.discovery).some(x=>x.includes("−5%")));
});
test("missing 5d evidence and malformed rows cannot become wins",()=>{
 const missing=signal(date(10,8),"TPR_V1",100,3,0,{
 completed:0,up_count:0,avg_return:null,worst_return:null,codes:[]});
 assert.equal(normaliseDaily(missing).done,0);
 assert.equal(chosen("TPR_V1")([missing]).discovery.cases,0);
 assert.equal(normaliseDaily({...missing,up_count:1}),null);
 assert.equal(normaliseDaily({...missing,codes:["DROP"]}),null);
});
test("same signal/day duplicate input does not increase completed cases",()=>{
 const rows=[signal(date(10,8),"MM_V1",20,3,0.1)];
 assert.equal(chosen("MM_V1")([...rows,...rows]).discovery.cases,20);
});
test("confirmation threshold cannot be satisfied with low days despite many examples",()=>{
 const good={
 cases:200,days:3,codes:60,positiveRate:70,average5:3,
 severeLossRate:5,relativeToUniverse:1,dayWinRate:70
 };
 assert.ok(qualifyConfirmation(good).some(x=>x.includes("判定日10日")));
});
test("read-only source adapters, owner-only route and no autonomous trade/notification mutation",()=>{
 const loader=readFileSync("app/lib/research/researchAllStarData.ts","utf8");
 const page=readFileSync("app/admin/research-allstars/page.tsx","utf8");
 const hub=readFileSync("app/admin/learning-hub/page.tsx","utf8");
 assert.match(loader,/validation_mode='FORWARD'/);
 assert.match(loader,/signal_version='MM_V1'/);
 assert.match(loader,/rule_version='ai_power_only_v1'/);
 assert.match(loader,/decision_status='AVOID'/);
 assert.match(loader,/FILTER\(WHERE u.outcome IS NOT NULL\)/);
 assert.match(loader,/benchmark_completed/);
 assert.doesNotMatch(loader,/INSERT INTO|UPDATE public\.|DELETE FROM|fetch\(/i);
 assert.match(page,/getLearningOwnerSession\(\)/);
 assert.match(page,/if\(!isOwner\)notFound\(\)/);
 assert.match(page,/winners.length===0/);
 assert.match(page,/CONFIRMATION_FROM/);
 assert.match(page,/認定された法則はありません/);
 assert.match(page,/売買推奨でもありません/);
 assert.match(hub,/\/admin\/research-allstars/);
});
