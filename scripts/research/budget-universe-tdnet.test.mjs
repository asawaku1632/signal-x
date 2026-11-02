import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {freezeBudgetUniverse,BUDGET_UNIVERSE_POLICY}
  from "../../app/lib/research/budgetUniverseFreeze.mjs";
import {normalizeTdnetIndex,readAuthorizedTdnetIndex,linkFrozenBudgetTdnetHints}
  from "../../app/lib/research/authorizedTdnetIndex.mjs";
const base={
  sourceDate:"2026-11-02",tradeDate:"2026-11-04",
  frozenAt:"2026-11-02T18:10:00+09:00",
  expectedUniverseCount:100,
};
const source=()=>Array.from({length:100},(_,i)=>({
  code:String(1000+i),name:"sample"+i,
  score:i%5===0?95:i%5===1?90:i%5===2?87:55,
  price:[500,1600,3200,4600][i%4],
  snapshotDate:"2026-11-02",
  savedAt:"2026-11-02T17:05:00+09:00",
}));
const freeze=(args={})=>freezeBudgetUniverse({...base,rows:source(),...args});
test("whole-market snapshot covers 100 records, not just top five",()=>{
  const r=freeze();assert.equal(r.observedUniverseCount,100);
  assert.equal(r.cohort.length,60);
  assert.equal(r.budgets.length,4);
  assert.equal(r.policy,BUDGET_UNIVERSE_POLICY);
  assert.match(r.sha256,/^[0-9a-f]{64}$/);
});
test("every budget list captures all eligible codes in deterministic score order",()=>{
  const r=freeze();
  for(const b of r.budgets){
    assert.ok(b.codes.length>0);
    const candidates=r.cohort.filter(x=>b.codes.includes(x.code));
    assert.ok(candidates.every(x=>x.referenceCostYen<=b.budgetYen));
    assert.equal(candidates.length,b.codes.length);
  }
  assert.equal(r.budgets.at(-1).codes.length,60);
});
test("canonical hash cannot be manipulated by SQL row order",()=>{
  const a=freeze(),b=freeze({rows:source().reverse()});
  assert.equal(a.sha256,b.sha256);assert.deepEqual(a.cohort,b.cohort);
});
test("missing 21% source universe rejects selection bias",()=>{
  assert.throws(()=>freeze({rows:source().slice(0,79)}),/COVERAGE_TOO_LOW/);
});
test("a read capped above 1500 cannot silently freeze only a subset",()=>{
  assert.throws(()=>freeze({rows:Array.from({length:1501},(_,i)=>({...source()[0],code:String(i+1000)}))}),/CAPPED/);
});
test("an exact duplicate stock-date must be examined, not arbitrarily chosen",()=>{
  assert.throws(()=>freeze({rows:[...source(),source()[1]]}),/DUPLICATE_DAY_CODE/);
});
test("any records entered after 18:10 are not accepted as earlier evidence",()=>{
  const rows=source();rows[0]={...rows[0],savedAt:"2026-11-02T18:11:00+09:00"};
  const r=freeze({rows});assert.equal(r.invalidRowCount,1);
  assert.equal(r.cohort.some(c=>c.code==="1000"),false);
});
test("refuse frozen cohorts outside exchange night window",()=>{
  assert.throws(()=>freeze({frozenAt:"2026-11-02T17:55:00+09:00"}),/OUTSIDE/);
  assert.throws(()=>freeze({frozenAt:"2026-11-03T09:10:00+09:00"}),/OUTSIDE/);
});
test("invalid or missing saved timestamp is not made up",()=>{
  const rows=source();rows[0]={...rows[0],savedAt:"not-a-timestamp"};
  const r=freeze({rows});assert.equal(r.invalidRowCount,1);
});
test("the new freeze is explicitly not a live trading rule",()=>{
  const page=readFileSync("app/admin/night-morning-watch/page.tsx","utf8");
  const route=readFileSync("app/api/admin/budget-universe-shadow/route.ts","utf8");
  const runner=readFileSync("app/lib/research/budgetUniverseFreezeRunner.ts","utf8");
  const vercel=readFileSync("vercel.json","utf8");
  assert.match(page,/fullBudgetSnapshot/);
  assert.match(route,/getLearningOwnerSession/);
  assert.match(route,/origin!==new URL\(request.url\).origin/);
  assert.match(route,/BUDGET_UNIVERSE_SHADOW_WRITE_ENABLED/);
  assert.match(runner,/ON CONFLICT \(trade_date\) DO NOTHING/);
  assert.doesNotMatch(vercel,/budget-universe-shadow/);
});
const td={
 data:[{DiscNo:"20261102533300",Code:"53330",Name:"日本ガイシ",
  DiscDate:"2026-11-02",DiscTime:"15:40",
  Title:"2027年3月期通期業績予想の上方修正に関するお知らせ",
  DiscStatus:null,RevNo:"1",DiscItems:["11101"],Docs:["g"]}]
};
const opts={date:"2026-11-02",observedAt:"2026-11-02T16:30:00+09:00"};
test("TDnet 5-digit zero-suffix code becomes 4-digit JPX code without guessing",()=>{
 const r=normalizeTdnetIndex(td,opts);
 assert.equal(r.items[0].code,"5333");
 assert.equal(r.items[0].publishedAt,"2026-11-02T06:40:00.000Z");
 assert.equal(r.items[0].hint,"UPWARD_REVISION_TITLE_ONLY");
 assert.equal(r.items[0].status,"INDEX_HINT_ONLY");
 assert.equal(r.items[0].observedAt,"2026-11-02T07:30:00.000Z");
});
test("no mistaken inference that a title alone proves upward financial guidance",()=>{
 const r=normalizeTdnetIndex(td,opts);
 assert.equal(r.items[0].status,"INDEX_HINT_ONLY");
 assert.equal("earningsRevised" in r.items[0],false);
});
test("earlier-than-publication receipt is invalid, never backdated",()=>{
 const r=normalizeTdnetIndex(td,{...opts,observedAt:"2026-11-02T15:00:00+09:00"});
 assert.equal(r.items.length,0);assert.equal(r.invalid,1);
});
test("nonzero fifth digit, missing dates and invalid time are excluded",()=>{
 const data={data:[{...td.data[0],Code:"53331"},
   {...td.data[0],DiscNo:"20261102533301",DiscTime:"99:11"},
   {...td.data[0],DiscNo:"20261102533302",DiscDate:"2026-11-01"}]};
 const r=normalizeTdnetIndex(data,opts);
 assert.equal(r.items.length,0);assert.equal(r.invalid,3);
});
test("repeated discNo never double counts",()=>{
 const r=normalizeTdnetIndex({data:[td.data[0],td.data[0]]},opts);
 assert.equal(r.items.length,1);
});
test("disabled paid addon performs exactly zero network calls",async()=>{
 let calls=0;
 const r=await readAuthorizedTdnetIndex({date:"2026-11-02",
  enabled:false,approved:true,apiKey:"synthetic",
  fetcher:async()=>{calls++;throw Error("network must not be called");}});
 assert.equal(r.status,"DISABLED_NO_COST");assert.equal(calls,0);
});
test("paid adapter also requires separate explicit approval",async()=>{
 let calls=0;
 const r=await readAuthorizedTdnetIndex({date:"2026-11-02",
  enabled:true,approved:false,apiKey:"synthetic",
  fetcher:async()=>{calls++;throw Error("network must not be called");}});
 assert.equal(r.networkCalls,0);assert.equal(calls,0);
});
test("authorized official adapter forwards key only to official domain via header",async()=>{
 let url="",header="",calls=0;
 const r=await readAuthorizedTdnetIndex({date:"2026-11-02",
 enabled:true,approved:true,apiKey:"synthetic",
 now:new Date("2026-11-02T07:30:00Z"),
 fetcher:async(u,init)=>{calls++;url=u;header=init.headers["x-api-key"];return {ok:true,json:async()=>td};}});
 assert.equal(calls,1);
 assert.equal(new URL(url).origin,"https://api.jquants.com");
 assert.equal(new URL(url).pathname,"/v2/td/list");
 assert.equal(header,"synthetic");
 assert.equal(r.status,"INDEX_ONLY");
});
test("pagination means index coverage is incomplete, never silently success",async()=>{
 const r=await readAuthorizedTdnetIndex({date:"2026-11-02",
 enabled:true,approved:true,apiKey:"synthetic",
 now:new Date("2026-11-02T07:30:00Z"),
 fetcher:async()=>({ok:true,json:async()=>({...td,pagination_key:"MORE"})})});
 assert.equal(r.status,"INCOMPLETE_PAGINATION");
});
test("403 upstream is not treated as entitled or proof of a disclosure",async()=>{
 const r=await readAuthorizedTdnetIndex({date:"2026-11-02",
 enabled:true,approved:true,apiKey:"synthetic",
 fetcher:async()=>({ok:false,status:403})});
 assert.equal(r.status,"UPSTREAM_ERROR");
 assert.equal(r.items.length,0);
});

test("licensed TDnet index known before freeze annotates existing candidate only",()=>{
  const snap=freeze();
  const payload={data:[{...td.data[0],DiscNo:"20261102100000",Code:"10000"}]};
  const records=normalizeTdnetIndex(payload,opts).items;
  const result=linkFrozenBudgetTdnetHints(snap,records);
  assert.equal(result.snapshotHash,snap.sha256);
  assert.equal(result.matchedSymbols,1);
  assert.equal(result.rows.find(r=>r.code==="1000").evidenceStatus,"TITLE_KNOWN_AS_OF_ONLY");
  assert.equal(result.rows.find(r=>r.code==="1000").hints[0].status,"TIMING_ELIGIBLE_INDEX_ONLY");
  assert.equal(snap.cohort.find(r=>r.code==="1000").evidence,"PRE_FROZEN_AI_ONLY");
});
test("publication known only after freeze is NOT retroactively linked",()=>{
  const snap=freeze();
  const payload={data:[{...td.data[0],DiscNo:"20261102100000",Code:"10000"}]};
  const records=normalizeTdnetIndex(payload,{
    ...opts,observedAt:"2026-11-02T18:30:00+09:00"}).items;
  const result=linkFrozenBudgetTdnetHints(snap,records);
  assert.equal(result.matchedSymbols,0);
  assert.equal(result.postFreeze,1);
});
test("corrupted snapshot or fabricated title cannot change frozen records",()=>{
  const snap=freeze();
  assert.throws(()=>linkFrozenBudgetTdnetHints({...snap,sha256:"fake"},[]));
  const result=linkFrozenBudgetTdnetHints(snap,[{
    source:"unverified-forum",status:"INDEX_HINT_ONLY",code:"1000",discNo:"20261102100000",
    publishedAt:"2026-11-02T06:40:00Z",observedAt:"2026-11-02T07:30:00Z",
    hint:"UPWARD_REVISION_TITLE_ONLY",
  }]);
  assert.equal(result.matchedSymbols,0);
  assert.equal(result.invalid,1);
});
