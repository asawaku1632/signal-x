import test from "node:test";
import assert from "node:assert/strict";
import {jstStudyClock,evaluateRecheckResearchHealth,RECHECK_HEALTH_SCHEDULE} from "../app/lib/research/recheckResearchHealth.mjs";
const now=(hour,min=0,date="2026-10-15")=>new Date(date+"T"+String(hour).padStart(2,"0")+":"+String(min).padStart(2,"0")+":00+09:00");
const study=(d,props={})=>evaluateRecheckResearchHealth({now:d,tradeDate:jstStudyClock(d).date,
  tradingDay:true,expectedCohort:5,recheckCount:0,closeRun:null,matchedCount:0,...props});
const run=(good=5)=>({status:good===5?"COMPLETE":"PARTIAL",
  results:Array.from({length:5},(_,i)=>({complete:i<good}))});
test("research clock uses Japanese wall time, independent of runner timezone",()=>{
  assert.deepEqual(jstStudyClock(now(10,34)),{date:"2026-10-15",minute:634});
  assert.deepEqual(RECHECK_HEALTH_SCHEDULE,{recheck:"10:34",close:"16:45",
    recheckGrace:"10:50",closeGrace:"17:05"});
});
test("before release and market closed are never incorrectly marked missing",()=>{
  assert.equal(study(now(18,0,"2026-10-14")).overall,"NOT_STARTED");
  assert.equal(study(now(17,30,"2026-10-17"),{tradingDay:false}).overall,"MARKET_CLOSED");
});
test("10:34 is not a failed run; missing data after 10:50 is separately labeled",()=>{
  assert.equal(study(now(10,34)).recheck,"PENDING");
  assert.equal(study(now(10,51)).recheck,"MISSING");
  assert.equal(study(now(10,51),{recheckCount:3}).recheck,"PARTIAL");
  assert.equal(study(now(10,51),{recheckCount:5}).recheck,"RECORDED");
});
test("after 17:05 identifies absent closing archive without falsely concluding strategy won",()=>{
  const s=study(now(17,10),{recheckCount:5});
  assert.equal(s.recheck,"RECORDED");
  assert.equal(s.close,"MISSING");
  assert.equal(s.comparison,"PENDING");
  assert.equal(s.overall,"CHECK_REQUIRED");
});
test("good fixed five captured, complete results and match are healthy",()=>{
  const s=study(now(17,10),{recheckCount:5,closeRun:run(),matchedCount:5});
  assert.equal(s.overall,"RECORDED");
  assert.equal(s.comparison,"RECORDED");
  assert.equal(s.closingValidCount,5);
});
test("partial Yahoo bars remain partial and do not impersonate full coverage",()=>{
  const s=study(now(17,10),{recheckCount:5,closeRun:run(4),matchedCount:4});
  assert.equal(s.close,"PARTIAL");
  assert.equal(s.overall,"PARTIAL");
});
test("missing matched AI/price pairs even with archives is flagged",()=>{
  const s=study(now(17,10),{recheckCount:5,closeRun:run(),matchedCount:0});
  assert.equal(s.overall,"CHECK_REQUIRED");
  assert.equal(s.comparison,"MISSING_VALID_PAIRS");
});
test("read errors are not silently reported as pending or successful",()=>{
  const s=study(now(11),{hasObservationReadError:true});
  assert.equal(s.recheck,"READ_ERROR");assert.equal(s.overall,"CHECK_REQUIRED");
});
