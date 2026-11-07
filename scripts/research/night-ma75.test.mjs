import test from "node:test";
import assert from "node:assert/strict";
import {evaluateNightMa75} from "../../app/lib/nightMa75.mjs";
const times=Array.from({length:76},(_,i)=>100000+i*86400);
const bars=times.map(time=>({time,close:100}));
test("rising close breakout uses both daily SMA values",()=>{
 const input=bars.map(b=>({...b}));input[75].close=110;
 const r=evaluateNightMa75(input,times);
 assert.equal(r.status,"AVAILABLE");assert.equal(r.previous,100);
 assert.equal(r.value,100+10/75);assert.equal(r.rising,true);assert.equal(r.breakout,true);assert.equal(r.above,true);
});
test("flat equality is not breakout",()=>{const r=evaluateNightMa75(bars,times);assert.equal(r.rising,false);assert.equal(r.above,false);assert.equal(r.breakout,false);});
test("already above yesterday is not a fresh breakout",()=>{
 const input=bars.map((b,i)=>({...b,close:i>=74?110:100}));
 assert.equal(evaluateNightMa75(input,times).breakout,false);
});
test("missing trading day never compresses the 75-day window",()=>{
 assert.equal(evaluateNightMa75(bars.slice(1),times).status,"INSUFFICIENT_HISTORY");
});
test("future data does not affect the frozen date",()=>{
 assert.deepEqual(evaluateNightMa75([...bars,{time:times[75]+86400,close:10000}],times),evaluateNightMa75(bars,times));
});
test("rejects duplicate timestamps and invalid prices",()=>{
 assert.equal(evaluateNightMa75([...bars,bars[0]],times).status,"INVALID_HISTORY");
 assert.equal(evaluateNightMa75(bars.map((b,i)=>i===5?{...b,close:NaN}:b),times).status,"INSUFFICIENT_HISTORY");
});
test("falling SMA and price below line remain visible",()=>{
 const input=bars.map(b=>({...b}));input[75].close=90;
 const r=evaluateNightMa75(input,times);assert.equal(r.rising,false);assert.equal(r.above,false);assert.ok(r.distancePercent<0);
});
