import test from "node:test";
import assert from "node:assert/strict";
import {planSevenStockCompletion,TARGET_STOCKS,TARGET_AFTER_DATES} from "../scripts/research/bb-nov4-five-stocks-capture-plan.mjs";
const capture=(code,dates)=>({file:"test.json",capture:{code,
 minuteDays:dates.map(date=>({date,pages:[]})),
 dailyDays:dates.map(date=>({date,pages:[]}))}});
test("exact target five stocks, dates and 200 worst-case request bound",()=>{
 const entries=TARGET_STOCKS.map(code=>capture(code,["2026-11-04"]));
 const r=planSevenStockCompletion(entries);
 assert.deepEqual(TARGET_AFTER_DATES,["2026-11-05","2026-11-06","2026-11-09","2026-11-10","2026-11-11"]);
 assert.equal(r.missingStockDates,25);
 assert.equal(r.maxRequestsUnderExistingFourPageCap,200);
 assert.equal(r.zeroApiCalls,true);
 assert.equal(r.eligibleForProduction,false);
});
test("existing dates remain excluded from new capture plan",()=>{
 const entries=TARGET_STOCKS.map(code=>capture(code,["2026-11-04",
   ...(code==="1945"?["2026-11-05","2026-11-11"]:[])]));
 const r=planSevenStockCompletion(entries);
 assert.equal(r.missingStockDates,23);
 assert.equal(r.perStock[0].missingCount,3);
 assert.equal(r.perStock[0].dryRun.maxRequests,24);
});
test("missing original signal day blocks; no out-of-scope API",()=>{
 const entries=TARGET_STOCKS.map(code=>capture(code,code==="1945"?["2026-11-05"]:["2026-11-04"]));
 assert.throws(()=>planSevenStockCompletion(entries),/ORIGINAL_SIGNAL_DAY_NOT_PRESENT/);
});
