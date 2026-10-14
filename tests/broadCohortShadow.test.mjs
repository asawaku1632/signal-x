import test from "node:test";
import assert from "node:assert/strict";
import {BROAD_SHADOW_MAX_CODES,BROAD_SHADOW_SLOTS,freezeBroadCandidates,
 captureBroadCohort,summarizeBroadCoverage} from "../app/lib/research/broadCohortShadow.mjs";
const date="2026-10-15",priorDate="2026-10-14";
const now="2026-10-15T10:35:00+09:00";
const saved="2026-10-15T10:33:00+09:00";
const ts=(hour,min)=>Date.parse(date+"T"+hour+":"+min+":00+09:00")/1000;
const prior=(count=40)=>Array.from({length:count},(_,i)=>({
 code:String(3000+i),name:"NAME_"+i,score:100-i/10,price:1000+i
}));
const study=(rows,stocks,opts={})=>captureBroadCohort({
 cohort:rows,stocks,tradeDate:date,priorDate,timeSlot:"10:30",
 snapshotSavedAt:saved,now,...opts
});
test("deterministic top 30 of prior session; not all future-strongest names",()=>{
 const rows=prior(40).reverse();
 const chosen=freezeBroadCandidates(rows);
 assert.equal(chosen.length,BROAD_SHADOW_MAX_CODES);
 assert.equal(chosen[0].code,"3000");
 assert.equal(chosen.at(-1).code,"3029");
 assert.deepEqual(chosen.map(x=>x.priorRank),Array.from({length:30},(_,i)=>i+1));
});
test("duplicate, invalid and below 85 ignored; up to 30 not fabricated",()=>{
 const c=freezeBroadCandidates([prior(1)[0],prior(1)[0],
  {code:"abcd",name:"bad",score:99,price:1000},
  {code:"5000",name:"low",score:84,price:1000},
  {code:"5001",name:"bad price",score:96,price:0}]);
 assert.equal(c.length,1);
});
test("frozen prior strong names are still followed even after score falls below 85",()=>{
 const original=prior(30);
 const stocks=original.map((r,i)=>({...r,score:i?65:12,
  latestBarTimestamp:ts("10","20")}));
 const r=study(original,stocks);
 assert.equal(r.expected,30);assert.equal(r.valid.length,30);
 assert.equal(r.missing.length,0);
 assert.equal(r.valid[0].score,12);
 assert.equal(r.valid[29].priorRank,30);
});
test("missing stock, score, price, timestamp, stale bar individually excluded",()=>{
 const cohort=prior(5);
 const stocks=[
 {...cohort[0],score:49,latestBarTimestamp:ts("09","00")},
 {...cohort[1],score:null,latestBarTimestamp:ts("10","20")},
 {...cohort[2],price:0,latestBarTimestamp:ts("10","20")},
 {...cohort[3],score:90,latestBarTimestamp:null}
 ];
 const r=study(cohort,stocks);
 assert.equal(r.expected,5);
 assert.equal(r.valid.length,0);
 assert.deepEqual(r.missing.map(x=>x.reason),[
 "QUOTE_OLD_OR_WRONG_DAY","INVALID_AI_POWER","INVALID_PRICE",
 "QUOTE_TIME_UNKNOWN","NOT_IN_CACHED_SCAN"
 ]);
});
test("the snapshot itself must be timely; no stale partial archive can be considered valid",()=>{
 assert.throws(()=>study(prior(1),[],{snapshotSavedAt:"2026-10-15T09:00:00+09:00"}),
  /STALE_OR_INVALID_SNAPSHOT/);
});
test("bar captured after snapshot is invalid; a valid 10:20 bar is accepted",()=>{
 const cohort=prior(2);
 const r=study(cohort,[
 {...cohort[0],score:86,latestBarTimestamp:ts("10","20")},
 {...cohort[1],score:88,latestBarTimestamp:ts("10","40")}
 ]);
 assert.equal(r.valid.length,1);
 assert.equal(r.missing[0].reason,"QUOTE_OLD_OR_WRONG_DAY");
 assert.equal(r.valid[0].quoteTime,"2026-10-15T01:20:00.000Z");
});
test("all 7 slots known and coverage denominators preserve gaps",()=>{
 assert.equal(BROAD_SHADOW_SLOTS.length,7);
 const r=summarizeBroadCoverage([
  {trade_date:date,time_slot:"10:30",expected_count:30,observed_count:25},
  {trade_date:date,time_slot:"09:15",expected_count:30,observed_count:0}]);
 assert.equal(r.days,1);
 assert.equal(r.slots.find(x=>x.slot==="10:30").rate,25/30*100);
 assert.equal(r.slots.find(x=>x.slot==="09:15").rate,0);
 assert.equal(r.slots.find(x=>x.slot==="14:30").rate,null);
});
