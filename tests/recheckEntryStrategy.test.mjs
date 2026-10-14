import test from "node:test";
import assert from "node:assert/strict";
import {evaluateRecheckEntryStrategy} from "../app/lib/research/recheckEntryStrategy.mjs";
const date="2026-10-15",prior="2026-10-14";
const cand=(code,rank,score=95)=>({code,name:"STOCK_"+code,rank,score});
const stock=(code,early,late,close,complete=true)=>({
  code,complete,closePrice:close,
  entries:[{time:"09:05",entryPrice:early},{time:"11:00",entryPrice:late},
    {time:"13:00",entryPrice:complete?100:null}],
});
const run=(cohort,results)=>({trade_date:date,prior_date:prior,
  cohort,results,status:"PARTIAL"});
const gate=(code,score,extra={})=>({
  trade_date:date,prior_date:prior,time_slot:"10:30",code,
  prior_rank:code==="3762"?1:code==="6758"?2:3,
  ai_power:score,snapshot_saved_at:"2026-10-15T10:33:00+09:00",
  quote_timestamp:"2026-10-15T10:24:00+09:00",...extra,
});
test("actual historical pair requires a preceding 10:30 AI score, without lookahead",()=>{
 const data=evaluateRecheckEntryStrategy([run([
   cand("3762",1),cand("6758",2),cand("9984",3)],
   [stock("3762",3100,3120,3150,false),stock("6758",2000,1960,1940),
   stock("9984",5000,5050,5100)])],
   [gate("3762",91),gate("6758",74)]);
 assert.equal(data.candidates,3);
 assert.equal(data.evaluated,2);
 assert.equal(data.missingRechecks,1);
 assert.equal(data.buyCount,1);assert.equal(data.skipCount,1);
 assert.equal(data.gatedTotalPnl100,3000);
 assert.equal(data.earlyTotalPnl100,3000);
 assert.equal(data.alwaysLateTotalPnl100,1000);
 assert.equal(data.gateWinRate,100);
 assert.equal(data.avoidedLossTotal100,2000);
 assert.equal(data.missedOpportunityTotal100,0);
 assert.equal(data.analyzed.find(x=>x.code==="3762").decision,"BUY");
 // Incomplete 13:00 bar should not invalidate the relevant 09:05+11:00 pair.
 assert.equal(data.analyzed.find(x=>x.code==="3762").earlyPnl100,5000);
});
test("skip is zero return, never counted as a win or a loss",()=>{
 const data=evaluateRecheckEntryStrategy([run([cand("6758",2)],
  [stock("6758",2000,2010,2050)])],[gate("6758",80)]);
 assert.equal(data.evaluated,1);assert.equal(data.buyCount,0);
 assert.equal(data.gateWinRate,null);
 assert.equal(data.gatedTotalPnl100,0);
 assert.equal(data.missedOpportunityTotal100,4000);
 assert.equal(data.avoidedLossTotal100,0);
});
test("score 85 includes a buy, 84.99 skips; invalid and missing scores rejected",()=>{
 const candidates=[cand("3762",1),cand("6758",2),cand("9984",3)];
 const results=candidates.map(c=>stock(c.code,100,100,110));
 const values=[gate("3762",85),gate("6758",84.99),gate("9984",null)];
 const data=evaluateRecheckEntryStrategy([run(candidates,results)],values);
 assert.equal(data.buyCount,1);
 assert.equal(data.skipCount,1);
 assert.equal(data.evaluated,2);
 assert.equal(data.excluded.find(x=>x.code==="9984").reason,"INVALID_AI_SCORE");
});
test("never buy using a 10:30 decision saved after the 11:00 simulated entry",()=>{
 const data=evaluateRecheckEntryStrategy([run([cand("3762",1)],[stock("3762",100,101,105)])],
  [gate("3762",95,{snapshot_saved_at:"2026-10-15T11:01:00+09:00"})]);
 assert.equal(data.evaluated,0);
 assert.equal(data.excluded[0].reason,"GATE_NOT_BEFORE_ENTRY");
});
test("different previous-night cohort, invalid quote as-of, missing 11:00 cannot be inferred",()=>{
 const arr=[
  gate("3762",95,{prior_date:"2026-10-13"}),
  gate("6758",95,{quote_timestamp:"2026-10-15T11:01:00+09:00"}),
  gate("9984",95),
 ];
 const data=evaluateRecheckEntryStrategy([run([
   cand("3762",1),cand("6758",2),cand("9984",3)],
   [stock("3762",100,100,110),stock("6758",100,100,110),
    stock("9984",100,null,110)])],arr);
 assert.equal(data.evaluated,0);
 assert.deepEqual(data.excluded.map(e=>e.reason),
  ["COHORT_MISMATCH","GATE_NOT_BEFORE_ENTRY","MISSING_PAIR_PRICE"]);
});
test("missing initial price, missing closing price and empty archive are not counted as missed trades",()=>{
 const data=evaluateRecheckEntryStrategy([run([cand("3762",1)],[stock("3762",null,100,100)])],[gate("3762",95)]);
 assert.equal(data.evaluated,0);
 assert.equal(data.gateWinRate,null);
 assert.equal(data.gatedTotalPnl100,0);
 assert.equal(evaluateRecheckEntryStrategy([],[]).candidates,0);
});
