import test from "node:test";
import assert from "node:assert/strict";
import { compareMmOutcomeShadow } from "../app/lib/research/mmOutcomeShadowComparison.mjs";
import { summarizeMmOutcomeShadow as summarize } from "../app/lib/research/mmOutcomeShadowSummary.mjs";

const dates=["2026-09-18","2026-09-24","2026-09-25","2026-09-28","2026-09-29","2026-09-30"];
const stock=new Map(dates.map((d,i)=>[d,100+i*2]));
const args={
  observations:[
    {code:"3762",tradeDate:"2026-09-18",storedResult1d:0,storedResult3d:6,storedResult5d:6},
    {code:"3996",tradeDate:"2026-09-18",storedResult1d:null,storedResult3d:null,storedResult5d:null},
  ],
  exchangeSessions:dates,calendarVerified:true,calendarComplete:true,
  stockClosesByCode:new Map([["3762",stock],["3996",stock]]),
  indexCloses:new Map(),asOfDate:"2026-10-01",
};

test("count corrected stock-only deltas without treating missing saved results as zero",()=>{
  const result=summarize(compareMmOutcomeShadow(args));
  assert.equal(result.status,"RESEARCH_ONLY");
  assert.equal(result.horizons[5].observations,2);
  assert.equal(result.horizons[5].comparable,1);
  assert.equal(result.horizons[5].changed,1);
  assert.equal(result.horizons[5].missingStored,1);
  assert.equal(result.horizons[5].missingBenchmark,2);
  assert.equal(result.horizons[5].benchmarked,0);
  assert.ok(Math.abs(result.horizons[5].meanDeltaPct-4)<1e-9);
  assert.equal(result.notificationEligible,false);
  assert.equal(result.historicalDataModified,false);
});

test("block unverified and invalid reports rather than summarizing them",()=>{
  assert.equal(summarize({status:"BLOCKED",rows:[]}).status,"BLOCKED");
  assert.equal(summarize({status:"RESEARCH_ONLY",rows:[]},{tolerancePct:-1}).status,"BLOCKED");
});

test("future horizons count pending without fabricated deltas",()=>{
  const result=summarize(compareMmOutcomeShadow({...args,asOfDate:"2026-09-29"}));
  assert.equal(result.horizons[5].pending,2);
  assert.equal(result.horizons[5].comparable,0);
  assert.equal(result.horizons[5].meanDeltaPct,null);
});

test("unchanged outcomes respect tolerance",()=>{
  const result=summarize(compareMmOutcomeShadow({...args,observations:[
    {code:"3762",tradeDate:"2026-09-18",storedResult1d:2,storedResult3d:6,storedResult5d:10},
  ]}));
  assert.equal(result.horizons[5].unchanged,1);
  assert.equal(result.horizons[5].changed,0);
});
