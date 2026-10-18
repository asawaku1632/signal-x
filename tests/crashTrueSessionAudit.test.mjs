import test from "node:test";
import assert from "node:assert/strict";
import { analyzeCrashStrength } from "../app/lib/research/crashStrengthShadow.mjs";
import { readFileSync } from "node:fs";

const marketDates=["2026-09-18","2026-09-24","2026-09-25","2026-09-28",
  "2026-09-29","2026-09-30","2026-10-01"];
const holidaySavedDates=["2026-09-21","2026-09-22"];
function fixture(){
  const nikkei=[100,96,97,98,99,101,102];
  const prices=[100,100,106,108,92,95,112];
  const marketRows=marketDates.map((date,i)=>({date,nikkei:nikkei[i],topix:null}));
  const byDate=new Map(marketDates.map((date,i)=>[date,prices[i]]));
  byDate.set("2026-09-21",100);
  byDate.set("2026-09-22",100);
  const priceRows=[];
  for(const date of [...byDate.keys()].sort()){
    priceRows.push({date,code:"1001",name:"Research",price:byDate.get(date)});
    for(let i=0;i<799;i++)priceRows.push({date,code:String(2000+i),name:"Filler",price:100});
  }
  return {marketRows,priceRows,asOf:"2026-10-02"};
}
test("market holiday snapshots are excluded and never counted as separate sessions",()=>{
  const result=analyzeCrashStrength(fixture());
  assert.equal(result.event.date,"2026-09-24");
  assert.equal(result.event.previousDate,"2026-09-18");
  assert.equal(result.coverage.validSavedDays,7);
  assert.equal(result.coverage.marketSessions,7);
  assert.equal(result.coverage.excludedSavedNonTradingDays,2);
  assert.deepEqual(result.coverage.excludedSavedDates,holidaySavedDates);
  const stock=result.strong.find(x=>x.code==="1001");
  assert.ok(stock);
  assert.equal(stock.after1,6);
  assert.equal(stock.after3,-8);
  assert.equal(stock.after5,12);
});
test("missing real next session cannot silently use a holiday or the session after next",()=>{
  const data=fixture();
  data.priceRows=data.priceRows.filter(r=>!(r.date==="2026-09-25"&&r.code==="2000"));
  const result=analyzeCrashStrength(data);
  const stock=result.strong.find(x=>x.code==="1001");
  assert.ok(stock);
  assert.equal(stock.after1,null);
  assert.equal(stock.after3,-8);
});
test("no real index bars means no fabricated ranking, despite complete fake saved holiday days",()=>{
  const data=fixture();
  const r=analyzeCrashStrength({...data,marketRows:[]});
  assert.equal(r.event,null);
  assert.equal(r.coverage.validSavedDays,0);
  assert.equal(r.coverage.excludedSavedNonTradingDays,9);
  assert.equal(r.nextDayEvidence,undefined);
});
test("a holiday with a price change cannot become an index-confirmed latest trading day",()=>{
  const data=fixture();
  for(const price of data.priceRows) if(price.date==="2026-09-22"&&price.code==="1001")price.price=777;
  const r=analyzeCrashStrength(data);
  assert.equal(r.recent.event.date,"2026-10-01");
  assert.equal(r.coverage.latestSavedDate,"2026-10-01");
  assert.equal(r.strong.find(x=>x.code==="1001").after1,6);
});
test("research page states real session horizons and keeps owner guard before DB read",()=>{
  const source=readFileSync(new URL("../app/admin/crash-strength/page.tsx",import.meta.url),"utf8");
  assert.match(source,/除外例/);
  assert.match(source,/excludedSavedNonTradingDays/);
  assert.match(source,/翌取引日/);
  assert.match(source,/3取引日後/);
  assert.match(source,/5取引日後/);
  assert.ok(source.indexOf("if (!isOwner) notFound()") < source.indexOf("await getReport()"));
  assert.doesNotMatch(source,/INSERT INTO|UPDATE public\.|DELETE FROM|createOrder|sendLine/);
});
