import test from "node:test";
import assert from "node:assert/strict";
import {collectFixedStabilityObservations} from "../app/lib/research/fixedCohortJudgment.mjs";
const study=(cohort,stocks,now="2026-10-15T09:33:00+09:00")=>
  collectFixedStabilityObservations({cohort,stocks,tradeDate:"2026-10-15",
    priorDate:"2026-10-14",timeSlot:"09:30",
    snapshotSavedAt:"2026-10-15T09:32:00+09:00",now});
const unix=(str)=>Date.parse(str)/1000;
const previous=[
 {code:"3762",name:"テクマトリックス",score:99,price:3205},
 {code:"6758",name:"ソニー",score:95,price:4000},
 {code:"9984",name:"ソフトバンクG",score:90,price:5800},
];
test("fixed prior-day candidates survive market score drops and reorder",()=>{
 const data=study(previous,[
   {code:"9984",price:5700,score:15,latestBarTimestamp:unix("2026-10-15T09:20:00+09:00")},
   {code:"6758",price:4050,score:80,latestBarTimestamp:unix("2026-10-15T09:25:00+09:00")},
   {code:"3762",price:3150,score:49,latestBarTimestamp:unix("2026-10-15T09:20:00+09:00")},
 ]);
 assert.deepEqual(data.valid.map(v=>v.code),["3762","6758","9984"]);
 assert.deepEqual(data.valid.map(v=>v.score),[49,80,15]);
 assert.deepEqual(data.valid.map(v=>v.priorScore),[99,95,90]);
});
test("stale, next-day and missing timestamps are skipped, never repaired",()=>{
 const data=study(previous,[
 {code:"3762",price:3150,score:49,latestBarTimestamp:unix("2026-10-15T08:50:00+09:00")},
 {code:"6758",price:4050,score:88,latestBarTimestamp:unix("2026-10-14T15:25:00+09:00")},
 {code:"9984",price:5700,score:80},
 ]);
 assert.equal(data.expected,3);assert.equal(data.valid.length,0);
 assert.deepEqual(data.missing.map(x=>x.reason),[
  "STALE_OR_WRONG_DAY_BAR","STALE_OR_WRONG_DAY_BAR","INVALID_OR_MISSING_QUOTE"]);
});
test("missing or malformed stock score cannot become a false PASS",()=>{
 const data=study(previous,[
 {code:"3762",price:3150,score:null,latestBarTimestamp:unix("2026-10-15T09:20:00+09:00")},
 ]);
 assert.equal(data.valid.length,0);
 assert.equal(data.missing[0].reason,"INVALID_OR_MISSING_QUOTE");
});
test("fresh within 25m and valid Japan timestamp are accepted",()=>{
 const data=study([previous[0]],[{code:"3762",price:3120,score:64.9,
  latestBarTimestamp:unix("2026-10-15T09:08:00+09:00")}]);
 assert.equal(data.valid[0].score,64.9);
 assert.equal(data.valid[0].quoteTimestamp,"2026-10-15T00:08:00.000Z");
});
test("same four-digit cohort is bounded to five and excludes non prior-day candidates",()=>{
 const inputs=Array.from({length:12},(_,i)=>({code:String(3000+i),name:"A",score:99-i,price:1500}));
 const stocks=inputs.map(s=>({...s,latestBarTimestamp:unix("2026-10-15T09:15:00+09:00")}));
 const data=study(inputs,stocks);
 assert.equal(data.expected,5);assert.equal(data.valid.length,5);
});
