import test from "node:test";
import assert from "node:assert/strict";
import {planMissingFiveDays} from "../scripts/research/bb-missing-five-days.mjs";
const group=(date,codes,examples=[])=>({date,slot:"14:15",codes,
 distinctObservedStocks:codes.length,priorMarket:"DOWN",
 mature5d:examples.length,notMature5d:codes.length-examples.length,examples});
const archive=(code,days)=>({capture:{code,minuteDays:days.map(date=>({date})),
 dailyDays:days.map(date=>({date}))}});
const baseline=groupedEvents=>({status:"BB_STITCHED_LOCAL_OBSERVATIONS_ONLY",
 sourceArchiveFiles:3,groupedEvents,
 uniqueClassifiedBuyEvents:groupedEvents.reduce((s,g)=>s+g.codes.length,0),
 mature5d:groupedEvents.reduce((s,g)=>s+g.mature5d,0)});
test("missing sessions count distinct stock/date and prioritize 7-stock cluster",()=>{
 const g=group("2026-11-04",["7752","7203"]);
 const entries=[archive("7752",["2026-11-04","2026-11-05"]),
  archive("7203",["2026-11-04"])];
 const r=planMissingFiveDays({baseline:baseline([g]),entries});
 assert.equal(r.pending5d,2);
 assert.equal(r.missingBySignal[0].missingCount,4);
 assert.equal(r.missingBySignal[1].missingCount,5);
 assert.equal(r.eligibleForProduction,false);
});
test("same stock missing date reused across signals without duplicate retrieval",()=>{
 const g1=group("2026-10-27",["8053"]);
 const g2=group("2026-10-29",["8053"]);
 const r=planMissingFiveDays({baseline:baseline([g1,g2]),
  entries:[archive("8053",["2026-10-27","2026-10-29"])]});
 assert.equal(r.pending5d,2);
 assert.ok(r.distinctMissingStockDates < r.missingBySignal.reduce((n,e)=>n+e.missingCount,0));
});
test("inconsistent completed status cannot become a retrieval plan",()=>{
 const g=group("2026-11-04",["7752"]);
 assert.throws(()=>planMissingFiveDays({baseline:baseline([g]),
 entries:[archive("7752",["2026-11-04","2026-11-05","2026-11-06","2026-11-09","2026-11-10","2026-11-11"])]}),/UNMATURE_DESPITE_COMPLETE_DATES/);
});
