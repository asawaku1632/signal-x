import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeCrashStrength } from "../app/lib/research/crashStrengthShadow.mjs";

function dates(count=16) {
  const ds=[];
  for(let i=0;ds.length<count;i++) {
    const d=new Date(Date.parse("2026-09-01T00:00:00Z")+i*86400000);
    if(d.getUTCDay()!==0&&d.getUTCDay()!==6)ds.push(d.toISOString().slice(0,10));
  }
  return ds;
}
function fixture(withLater=false) {
  const ds=dates(withLater?17:16);
  const marketRows=ds.map((date,i)=>({date,nikkei:i%2===0?100:96,topix:200+(i%2===0?0:-8)}));
  const priceRows=[];
  for(let i=0;i<ds.length;i++) {
    const date=ds[i];
    // On a crash: price 100. In the following session:
    // A rises 2% but LOSES to the +4.17% Nikkei rebound.
    // B rises 10% and BEATS the Nikkei.
    // C loses 10% and is clearly weaker than the index.
    for(const [code,name,up] of [
      ["1001","AbsoluteWinner",102],["1002","MarketWinner",110],["1003","Underperformer",90]
    ]) priceRows.push({date,code,name,price:i%2===0?up:100});
    for(let j=0;j<797;j++) priceRows.push({date,code:String(2000+j),name:"Control",price:100});
  }
  return {marketRows,priceRows,asOf:"2026-10-18",ds};
}
function analyze(f) {return analyzeCrashStrength(f);}
test("positive absolute returns can still lose to Nikkei in exactly paired sessions",()=>{
  const r=analyze(fixture());
  const candidates=r.nextDayEvidence;
  assert.equal(candidates.settledPastEpisodes,7);
  const a=candidates.leaders.find(x=>x.code==="1001");
  const b=candidates.benchmarkLeaders.find(x=>x.code==="1002");
  assert.ok(a && b);
  assert.equal(a.positiveRate1,100);
  assert.equal(a.benchmarkBeatRate,0,"positive day alone is not a Nikkei beat");
  assert.equal(a.average1,2);
  assert.equal(a.benchmarkSampleCount,7);
  assert.equal(a.benchmarkStockAverage1,2);
  assert.equal(a.benchmarkAverage1,4.17);
  assert.equal(a.averageExcess1,-2.17);
  assert.equal(b.positiveRate1,100);
  assert.equal(b.benchmarkBeatRate,100);
  assert.equal(b.benchmarkSampleCount,7);
  assert.equal(b.averageExcess1,5.83);
  assert.equal(b.outperformedCount,7);
  assert.equal(candidates.benchmarkLaggers.find(x=>x.code==="1003").benchmarkBeatRate,0);
});
test("the latest crash must not leak into historic beat rate even after following session settles",()=>{
  const before=analyze(fixture());
  const after=analyze(fixture(true));
  const read=x=>x.nextDayEvidence.benchmarkLeaders.find(e=>e.code==="1002");
  assert.deepEqual(read(before),read(after));
  assert.equal(before.nextDayEvidence.retrospectiveReplay.status,"PENDING_REFERENCE_OR_PRICES");
  assert.equal(after.nextDayEvidence.retrospectiveReplay.status,"RETROSPECTIVE_ONLY");
  assert.equal(after.nextDayEvidence.retrospectiveReplay.indexReturn1,4.17);
  assert.equal(after.nextDayEvidence.retrospectiveReplay.leaders.beatCount,1);
  assert.equal(after.nextDayEvidence.retrospectiveReplay.leaders.observedCount,20);
});
test("no Nikkei closes means benchmark rankings withheld instead of using TOPIX silently",()=>{
  const f=fixture();
  f.marketRows=f.marketRows.map(r=>({...r,nikkei:null}));
  const r=analyze(f);
  assert.equal(r.nextDayEvidence.eligibleCount,800);
  assert.equal(r.nextDayEvidence.benchmarkEligibleCount,0);
  assert.deepEqual(r.nextDayEvidence.benchmarkLeaders,[]);
  assert.equal(r.nextDayEvidence.retrospectiveReplay.indexReturn1,null);
});
test("missing actual next-session saved prices cannot be swapped with later date",()=>{
  const f=fixture();
  const next=f.ds[4];
  f.priceRows=f.priceRows.filter(row=>!(row.date===next&&row.code==="2000"));
  const r=analyze(f);
  const a=r.nextDayEvidence.benchmarkLeaders.find(x=>x.code==="1002");
  assert.equal(a.benchmarkSampleCount,5);
  assert.equal(a.outperformedCount,5);
});
test("UI remains owner-only and retrospective report clearly not a previously frozen prediction",()=>{
  const source=readFileSync(new URL("../app/admin/crash-strength/page.tsx",import.meta.url),"utf8");
  assert.ok(source.indexOf("if (!isOwner) notFound()")<source.indexOf("await getReport()"));
  assert.match(source,/日経平均に勝った銘柄ランキング/);
  assert.match(source,/事後再現/);
  assert.match(source,/事前保存した実証ではありません/);
  assert.doesNotMatch(source,/INSERT INTO|UPDATE public\.|DELETE FROM|createOrder|sendLine/);
});
