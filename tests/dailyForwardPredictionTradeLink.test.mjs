import test from "node:test";
import assert from "node:assert/strict";
import { linkForwardPredictionsToHypotheticalTrades } from "../app/lib/research/dailyForwardPredictionTradeLink.mjs";
const prediction={code:"7203",date:"2026-11-10",horizon:5,status:"VERIFIED",priceBasisVerified:true,returnPct:2};
const trade={id:"T1",code:"7203",signalDate:"2026-11-10",horizon:5,
 startDate:"2026-11-11",endDate:"2026-11-17",grossReturnPct:1,
 verified:true,priceBasisVerified:true,executionBasisVerified:true};
test("exact matching verified prediction links to offline hypothetical trade",()=>{
 const result=linkForwardPredictionsToHypotheticalTrades([prediction],[trade]);
 assert.equal(result.status,"LINKED_FOR_OFFLINE_RESEARCH_ONLY");
 assert.equal(result.linkedCount,1);
 assert.equal(result.linkedTrades[0].predictionKey,"7203|2026-11-10|5");
 assert.equal(result.improvementProven,false);
});
test("different horizon or stock fails closed",()=>{
 const result=linkForwardPredictionsToHypotheticalTrades([prediction],[{...trade,horizon:10}]);
 assert.equal(result.status,"BLOCKED");
 assert.ok(result.reasons.includes("NO_MATCHING_VERIFIED_PREDICTION"));
});
test("unverified execution basis fails closed",()=>{
 const result=linkForwardPredictionsToHypotheticalTrades([prediction],[{...trade,executionBasisVerified:false}]);
 assert.equal(result.status,"BLOCKED");
 assert.deepEqual(result.linkedTrades,[]);
});
test("duplicate predictions or trades fail closed",()=>{
 assert.equal(linkForwardPredictionsToHypotheticalTrades([prediction,prediction],[trade]).status,"BLOCKED");
 assert.equal(linkForwardPredictionsToHypotheticalTrades([prediction],[trade,trade]).status,"BLOCKED");
});
test("trade starting before signal is rejected",()=>{
 assert.ok(linkForwardPredictionsToHypotheticalTrades([prediction],[{...trade,startDate:"2026-11-09"}]).reasons.includes("INVALID_TRADE"));
});
