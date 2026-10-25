import test from "node:test";
import assert from "node:assert/strict";
import {normalizeResearchRows,compareResearchEvents} from "../../app/lib/research/dualSurgeComparison.mjs";
const source=Array.from({length:12},(_,i)=>({Code:"37620",Date:"2026-10-"+String(i+1).padStart(2,"0"),O:100+i,H:102+i,L:99+i,C:101+i,Vo:1000,AdjFactor:1}));
test("normalization sorts valid sessions",()=>{const rows=normalizeResearchRows([...source].reverse(),"3762");assert.equal(rows[0].date,"2026-10-01");assert.equal(rows.length,12)});
test("duplicate provider dates fail closed",()=>assert.throws(()=>normalizeResearchRows([...source,source[0]],"3762"),/DUPLICATE_PROVIDER_DATE/));
test("missing adjustment factor fails closed",()=>{const bad=structuredClone(source);delete bad[1].AdjFactor;assert.throws(()=>normalizeResearchRows(bad,"3762"),/UNKNOWN_ADJUSTMENT_FACTOR/)});
test("malformed price fails closed",()=>{const bad=structuredClone(source);bad[1].H=0;assert.throws(()=>normalizeResearchRows(bad,"3762"),/INVALID_PROVIDER_OHLCV/)});
test("wrong provider code fails closed",()=>{const bad=structuredClone(source);bad[0].Code="99990";assert.throws(()=>normalizeResearchRows(bad,"3762"),/INVALID_PROVIDER_ROW/)});
test("manual comparison keeps old and new five-day outcomes distinct",()=>{
 const distinctEntrySource=structuredClone(source);
 distinctEntrySource[1].O=103; // Day-2 open differs from day-1 close (101), and remains within OHLC bounds.
 const result=compareResearchEvents({code:"3762",providerRows:distinctEntrySource,signals:[{date:"2026-10-01",cohort:"PRE_SURGE_V1"}]});
 assert.equal(result.ledger.length,1);
 assert.equal(result.legacyFiveDay[0].matured,1);
 assert.equal(result.nextOpenFiveDay[0].matured,1);
 assert.notEqual(result.legacyFiveDay[0].averageReturnPct,result.nextOpenFiveDay[0].averageReturnPct);
 assert.equal(result.mode,"READ_ONLY_MANUAL_COMPARISON");
});
