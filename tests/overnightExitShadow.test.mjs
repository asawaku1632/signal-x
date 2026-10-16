import test from "node:test";
import assert from "node:assert/strict";
import {evaluateOvernightExit} from "../app/lib/research/overnightExitShadow.mjs";
const epoch=s=>Math.floor(Date.parse("2026-10-16T"+s+":00+09:00")/1000);
const bar=(s,price)=>({time:epoch(s),open:price,high:price+5,low:price-5,close:price});
test("overnight limit, 09:20 exit uses bar OPEN and computes 100-share PnL",()=>{
 const r=evaluateOvernightExit({tradeDate:"2026-10-16",limitYen:3280,candles:[bar("09:00",3270),bar("09:20",3384),bar("11:00",3425)]});
 assert.equal(r.status,"POTENTIAL_OPEN_FILL");
 assert.equal(r.exits.find(x=>x.time==="09:20").pnlYen,11400);
 assert.equal(r.exits.find(x=>x.time==="11:00").pnlYen,15500);
 assert.equal(r.exits.find(x=>x.time==="09:10").status,"MISSING_BAR");
});
test("gap above limit is not counted as a filled trade",()=>{
 const r=evaluateOvernightExit({tradeDate:"2026-10-16",limitYen:3280,candles:[bar("09:00",3390),bar("09:20",3420)]});
 assert.equal(r.status,"OPEN_ABOVE_LIMIT_UNVERIFIED");assert.equal(r.exits.length,0);
});
test("missing opening candle and invalid input are excluded",()=>{
 assert.equal(evaluateOvernightExit({tradeDate:"2026-10-16",limitYen:3280,candles:[bar("09:20",3300)]}).status,"MISSING_OPEN_BAR");
 assert.equal(evaluateOvernightExit({tradeDate:"2026-10-16",limitYen:-1,candles:[]}).status,"INVALID_INPUT");
});
