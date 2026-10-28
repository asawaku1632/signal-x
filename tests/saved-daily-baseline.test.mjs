import test from "node:test";
import assert from "node:assert/strict";
import {summarizeSavedDailyResults} from "../app/lib/research/savedDailyBaseline.mjs";
test("daily historical summary counts unique completed observations",()=>{
 const rows=[
  {date:"2026-10-26",code:"590A",score:90,price:100,next_price:105},
  {date:"2026-10-27",code:"1234",score:90,price:100,next_price:90},
  {date:"2026-10-27",code:"1234",score:90,price:100,next_price:90}
 ];
 const result=summarizeSavedDailyResults(rows,{minSamples:2});
 assert.equal(result.samples,2);
 assert.equal(result.excluded.duplicate,1);
 assert.equal(result.positiveRatePct,50);
});
