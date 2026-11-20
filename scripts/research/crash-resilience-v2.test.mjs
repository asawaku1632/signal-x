import test from "node:test";
import assert from "node:assert/strict";
import {analyzeCrashResilienceV2,compareEntrySlots} from "../../app/lib/research/crashResilienceV2.mjs";
const dates=["2026-11-12","2026-11-13","2026-11-16","2026-11-17","2026-11-18","2026-11-19","2026-11-20"];
const market=dates.map((date,i)=>({date,topix:[100,97,98,99,100,101,102][i]}));
const stocks=dates.flatMap((date,i)=>["1111","2222"].map((code,j)=>({date,code,close:j?100+i:100+[0,0,2,4,6,8,10][i]})));
test("TOPIX crash identifies reverse gains and relative strength without lookahead",()=>{
 const r=analyzeCrashResilienceV2({market,stocks,asOf:"2026-11-21",minimumCoverage:2});
 assert.equal(r.events.length,1);
 assert.equal(r.events[0].date,"2026-11-13");
 assert.equal(r.events[0].candidates.length,2);
 assert.equal(r.summaries[5].observedCount,2);
 assert.equal(r.summaries[10].observedCount,0);
});
test("as-of boundary excludes future index and prices",()=>{
 const r=analyzeCrashResilienceV2({market,stocks,asOf:"2026-11-16",minimumCoverage:2});
 assert.equal(r.summaries[1].observedCount,0);
});
test("missing stock day does not shift a horizon",()=>{
 const partial=stocks.filter(x=>!(x.date==="2026-11-16"&&x.code==="1111"));
 const r=analyzeCrashResilienceV2({market,stocks:partial,asOf:"2026-11-21",minimumCoverage:2});
 assert.equal(r.events[0].candidates.find(x=>x.code==="1111").returns[1],null);
});
test("entry slots require observed timestamps and do not fabricate missing fills",()=>{
 const r=compareEntrySlots({signalDate:"2026-11-19",code:"1111",slots:[{slot:"09:20",tradeDate:"2026-11-20",price:101,sourceTimestamp:"2026-11-20T09:20:00+09:00",capturedAt:"2026-11-20T09:21:00+09:00"}],exitClose:105});
 assert.equal(r[0].status,"REFERENCE_ONLY");
 assert.equal(r[1].entryPrice,null);
 assert.equal(r[2].returnToExit,null);
});
test("reject invalid dates and nonpositive prices",()=>{
 assert.throws(()=>analyzeCrashResilienceV2({asOf:"2026-11-31"}),/INVALID_AS_OF/);
 assert.equal(compareEntrySlots({signalDate:"2026-11-19",code:"1111",slots:[{slot:"09:20",tradeDate:"2026-11-20",price:0}],exitClose:105})[0].status,"MISSING_VERIFIED_REFERENCE");
});
