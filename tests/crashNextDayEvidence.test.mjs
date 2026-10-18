import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { analyzeCrashStrength, MIN_NEXT_DAY_EPISODES } from "../app/lib/research/crashStrengthShadow.mjs";

const DAY_MS=86400000;
function weekdays(start, count) {
  const values=[];
  for (let step=0; values.length<count && step<90;step++) {
    const date=new Date(Date.parse(start+"T00:00:00Z")+step*DAY_MS);
    if (date.getUTCDay()===0||date.getUTCDay()===6) continue;
    values.push(date.toISOString().slice(0,10));
  }
  return values;
}
function fixture() {
  const dates=weekdays("2026-09-01",16); // 8 crash events, latest is the final date
  const marketRows=dates.map((date,i)=>({date,nikkei:i%2===0?100:96,topix:null}));
  const priceRows=[];
  for(let i=0;i<dates.length;i++) {
    priceRows.push({date:dates[i],code:"1001",name:"HistoricallyUp",price:i%2===0?102:100});
    priceRows.push({date:dates[i],code:"1002",name:"HistoricallyDown",price:i%2===0?95:100});
    for(let j=0;j<798;j++)priceRows.push({date:dates[i],code:String(j+2000),name:"Other",price:100});
  }
  return {dates,marketRows,priceRows};
}
function report(f=fixture(),asOf="2026-10-18") {
  return analyzeCrashStrength({marketRows:f.marketRows,priceRows:f.priceRows,asOf});
}

test("minimum independent completed historical crashes produce meaningful per-stock ranks",()=>{
  const data=fixture();
  const result=report(data);
  assert.equal(MIN_NEXT_DAY_EPISODES,5);
  assert.equal(result.event.date,data.dates.at(-1));
  assert.equal(result.eventCount,8);
  const evidence=result.nextDayEvidence;
  assert.equal(evidence.selectedDate,data.dates.at(-1));
  assert.equal(evidence.settledPastEpisodes,7,
    "all seven preceding episodes close before the selected latest crash");
  const top=evidence.leaders.find(r=>r.code==="1001");
  const bad=evidence.laggers.find(r=>r.code==="1002");
  assert.ok(top);
  assert.ok(bad);
  assert.equal(top.sampleCount,7);
  assert.equal(top.positiveRate1,100);
  assert.equal(top.average1,2);
  assert.equal(bad.sampleCount,7);
  assert.equal(bad.positiveRate1,0);
  assert.equal(bad.average1,-5);
  assert.ok(evidence.eligibleCount>0);
});

test("latest event's future result cannot improve its historical ranking even if already saved",()=>{
  const data=fixture();
  const frozen=report(data);
  const afterDate="2026-09-23"; // after the last saved shock event (2026-09-22)
  assert.ok(data.dates.at(-1)<afterDate);
  data.marketRows.push({date:afterDate,nikkei:98,topix:null});
  for(let j=0;j<800;j++){
    const code=j===0?"1001":j===1?"1002":String(j-2+2000);
    data.priceRows.push({date:afterDate,code,name:"Later",price:j===0?400:j===1?1:100});
  }
  const newer=report(data);
  const select=r=>r.nextDayEvidence.leaders.find(x=>x.code==="1001");
  assert.deepEqual(select(newer),select(frozen));
  assert.equal(newer.nextDayEvidence.settledPastEpisodes,frozen.nextDayEvidence.settledPastEpisodes);
});

test("skipped or incomplete next session must not be replaced by a later snapshot",()=>{
  const data=fixture();
  // Every other event closes after its own next day. Remove one next-day full
  // snapshot; there must not be a substitute from two days later.
  const missing=data.dates[2];
  data.priceRows=data.priceRows.filter(r=>!(r.date===missing&&r.code==="2000"));
  const result=report(data);
  const up=result.nextDayEvidence.leaders.find(x=>x.code==="1001");
  assert.equal(up.sampleCount,5);
  assert.equal(result.nextDayEvidence.settledPastEpisodes,5);
});

test("fewer than five completed independent crash episodes never yields 'verified' ranks",()=>{
  const data=fixture();
  const marketRows=data.marketRows.slice(-9); // <= 4 past crashes
  const result=report({...data,marketRows});
  assert.equal(result.nextDayEvidence.eligibleCount,0);
  assert.deepEqual(result.nextDayEvidence.leaders,[]);
  assert.deepEqual(result.nextDayEvidence.laggers,[]);
});

test("no historical crash means no evidence; no DB write or public disclosure",()=>{
  const data=fixture();
  const empty=report({...data,marketRows:[]});
  assert.equal(empty.nextDayEvidence,undefined);
  const page=readFileSync(new URL("../app/admin/crash-strength/page.tsx",import.meta.url),"utf8");
  assert.ok(page.indexOf("if (!isOwner) notFound()")<page.indexOf("await getReport()"));
  assert.match(page,/NextDayEvidencePanel data=\{report\.nextDayEvidence\}/);
  assert.doesNotMatch(page,/INSERT INTO|DELETE FROM|UPDATE public\.|sendLine|createOrder/);
});
