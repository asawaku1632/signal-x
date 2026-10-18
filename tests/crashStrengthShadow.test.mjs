import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeCrashStrength, CRASH_STRENGTH_VERSION } from "../app/lib/research/crashStrengthShadow.mjs";

const days = ["2026-10-12","2026-10-13","2026-10-14","2026-10-15","2026-10-16",
  "2026-10-19","2026-10-20","2026-10-21","2026-10-22"];
const nikkei = [100,100,97,98,99,95,96,97,98];
function fixture() {
  const marketRows = days.map((date, i) => ({date, nikkei:nikkei[i], topix:nikkei[i]}));
  const priceRows = [];
  for (let j = 0; j < days.length; j++) {
    priceRows.push({date:days[j],code:"1001",name:"Resilient",price:[100,100,99,100,101,102,101,104,105][j]});
    priceRows.push({date:days[j],code:"1002",name:"Fragile",price:[100,100,95,94,94,88,89,91,92][j]});
    for (let i = 0; i < 798; i++) priceRows.push({date:days[j],code:String(2000+i),name:"Filler",price:100});
  }
  return {marketRows,priceRows};
}
const run = (changes={}, asOf="2026-10-20") => analyzeCrashStrength({...fixture(), ...changes, asOf});

test("detects latest genuine -2% saved-market shock and sorts by excess strength", () => {
  const result = run();
  assert.equal(result.version, CRASH_STRENGTH_VERSION);
  assert.equal(result.event.date, "2026-10-19");
  assert.equal(result.event.previousDate, "2026-10-16");
  assert.equal(result.eventCount, 2);
  const strong = result.strong.find(x=>x.code==="1001");
  const weak = result.weak.find(x=>x.code==="1002");
  assert.ok(strong);
  assert.ok(weak);
  assert.ok(strong.excessReturn > 0);
  assert.ok(weak.excessReturn < 0);
  assert.equal(result.examinedStocks, 800);
  assert.equal(strong.after1, null, "post-shock returns must stay pending");
});

test("captures only later stored outcomes, and does not present one prior crash as validated", () => {
  const result=run({},"2026-10-23");
  const strong=result.strong.find(x=>x.code==="1001");
  assert.equal(strong.after1, -0.98);
  assert.equal(strong.after3, 2.94);
  assert.equal(strong.historical1.sampleCount, 1);
  assert.equal(strong.historical1.average1, null);
  assert.equal(result.historical.strong.average1, null);
  assert.equal(result.historical.strong.eventCount, 1);
});

test("incomplete stock coverage rejects recent shock instead of ranking a partial scan", () => {
  const data=fixture();
  data.priceRows=data.priceRows.filter(r=>!(r.date==="2026-10-19"&&r.code==="2000"));
  const r=run(data);
  assert.equal(r.event.date,"2026-10-14");
  assert.ok(!r.strong.some(x=>x.after1!==null&&x.after1>100));
});

test("do not invent a market crash when price series or indices are unavailable", () => {
  const data=fixture();
  assert.equal(run({marketRows:[]}).event,null);
  assert.equal(run({priceRows:[]}).event,null);
  assert.equal(run({marketRows:data.marketRows.map(r=>({...r,nikkei:null,topix:null}))}).event,null);
});

test("invalid as-of date fails closed", () => {
  assert.throws(()=>run({},"tomorrow"),/INVALID_AS_OF_DATE/);
});

test("private page has owner gate and read-only data path, no orders or automated hooks", () => {
  const page=readFileSync(new URL("../app/admin/crash-strength/page.tsx",import.meta.url),"utf8");
  assert.match(page,/getLearningOwnerSession/);
  assert.match(page,/if \(!email\)/);
  assert.match(page,/Previewでログインする/);
  assert.match(page,/href="\/login"/);
  assert.ok(page.indexOf("if (!isOwner) notFound()") < page.indexOf("await getReport()"),
    "owner gate must run before query");
  assert.match(page,/if \(!isOwner\) notFound\(\)/);
  assert.match(page,/SELECT DISTINCT ON/);
  assert.match(page,/getCrashMarketReferences/);
  assert.match(page,/report\.recent/);
  assert.match(page,/if \(!isOwner\) notFound\(\)/);
  assert.doesNotMatch(page,/INSERT INTO|UPDATE public\.|DELETE FROM|sendLine|createOrder/);
});

test("normal sessions show latest market-relative rankings without pretending a crash", () => {
  const data=fixture();
  const quiet=data.marketRows.map((r,i)=>({...r,nikkei:100+i,topix:200+i*2}));
  const r=run({marketRows:quiet});
  assert.equal(r.event,null);
  assert.equal(r.eventCount,0);
  assert.equal(r.recent.event.date,"2026-10-19");
  assert.equal(r.recent.examinedStocks,800);
  assert.ok(r.recent.strong.length>0);
  assert.ok(r.recent.weak.length>0);
  assert.equal(r.recent.isLatestSavedDate,true);
});

test("a saved day without matching index stays explicitly out of routine ranking",()=>{
  const data=fixture();
  const markets=data.marketRows.filter(x=>x.date!=="2026-10-19");
  const r=run({marketRows:markets});
  assert.equal(r.recent.event.date,"2026-10-16");
  assert.equal(r.recent.isLatestSavedDate,false);
});

test("missing market observations never fabricate routine market-relative results",()=>{
  const r=run({marketRows:[]});
  assert.equal(r.recent,null);
  assert.equal(r.coverage.comparableDays,0);
});
