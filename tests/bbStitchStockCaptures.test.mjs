import test from "node:test";
import assert from "node:assert/strict";
import {segmentStockSessions,deduplicateSignalObservations,auditStitchedStocks} from "../scripts/research/bb-stitch-stock-captures.mjs";
const d=date=>({minute:{date},daily:{date}});
test("split only on missing JPX session, not weekends",()=>{
 const r=segmentStockSessions([d("2026-10-29"),d("2026-10-30"),d("2026-11-02"),d("2026-11-05")]);
 assert.equal(r.length,2);
 assert.equal(r[0].length,3);
 assert.equal(r[1].length,1);
});
test("reject duplicated, contradictory signal identities",()=>{
 assert.throws(()=>segmentStockSessions([d("2026-10-29"),d("2026-10-29")]),/DUPLICATE_UNMERGED_DATE/);
 assert.throws(()=>deduplicateSignalObservations([
  {code:"8053",date:"2026-10-27",slot:"14:15"},
  {code:"8053",date:"2026-10-27",slot:"14:15"}]),/DUPLICATE_BUY_EVENT_ACROSS_STOCK_SEGMENTS/);
});
test("no market or blank population fails closed",()=>{
 assert.throws(()=>auditStitchedStocks({benchmark:{benchmark:"TOPIX"},entries:[]}),/INVALID_STITCH_REQUEST/);
});
