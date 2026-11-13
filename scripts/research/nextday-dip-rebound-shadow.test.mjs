import test from "node:test";
import assert from "node:assert/strict";
import {analyzeDipRebound} from "./nextday-dip-rebound-shadow.mjs";
const dates=["2026-10-19","2026-10-20","2026-10-21","2026-10-22","2026-10-23","2026-10-26"];
const bar=(date,time,close,high=close,low=close)=>({code:"8830",date,time,open:close,high,low,close});
const bars=[
 bar(dates[0],"15:20",100),
 bar(dates[1],"09:15",96),bar(dates[1],"11:15",97),
 bar(dates[2],"09:15",98,100,95),
 bar(dates[3],"09:15",100,103,98),
 bar(dates[4],"09:15",101,102,99),
 bar(dates[5],"09:15",101,102,99)
];
const signals=[{code:"8830",signalDate:dates[0],signalAt:"2026-10-19T15:25:00+09:00",referencePrice:100}];
test("09:20 decision uses completed 09:15 candle, then future highs",()=>{
 const r=analyzeDipRebound({signals,bars},{entryTime:"09:20",horizon:3,threshold:5});
 assert.equal(r.downCount,1);assert.equal(r.targetCount,1);
 assert.equal(r.rows[0].entryPrice,96);assert.equal(r.rows[0].maxHigh,103);
 assert.equal(r.eligibleForTrading,false);
});
test("11:20 uses 11:15 candle and does not reuse morning price",()=>{
 const r=analyzeDipRebound({signals,bars},{entryTime:"11:20",horizon:3,threshold:7});
 assert.equal(r.rows[0].entryPrice,97);assert.equal(r.targetCount,0);
});
test("missing future data excluded, never counted as failure",()=>{
 const r=analyzeDipRebound({signals,bars:bars.slice(0,4)},{horizon:3});
 assert.equal(r.eligible,0);assert.equal(r.excluded.length,1);
});
test("duplicate bars fail closed",()=>{
 assert.throws(()=>analyzeDipRebound({signals,bars:[...bars,bars[0]]}),/Duplicate/);
});
test("missing or untrusted signal timestamp excluded",()=>{
 const r=analyzeDipRebound({signals:[{...signals[0],signalAt:null}],bars},{horizon:3});
 assert.equal(r.eligible,0);
});
