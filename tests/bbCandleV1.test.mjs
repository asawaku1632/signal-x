import test from "node:test";
import assert from "node:assert/strict";
import {detectBbCandleV1,evaluateBbCandleV1} from "../app/lib/research/bbCandleV1.mjs";

const c=(time,open,high,low,close)=>({time,open,high,low,close});
test("invalid and unordered candles fail closed",()=>{
  assert.throws(()=>detectBbCandleV1([c(1,100,99,90,95)]),/INVALID/);
  assert.throws(()=>detectBbCandleV1([c(2,100,101,99,100),c(1,100,101,99,100)]),/INVALID/);
});
test("no signal before sufficient completed 20-bar history",()=>{
  const a=Array.from({length:19},(_,i)=>c(i+1,100+i*.01,101+i*.01,99+i*.01,100+i*.01));
  assert.deepEqual(detectBbCandleV1(a),[]);
});
test("bullish outside-band wide-body signal and no lookahead",()=>{
  const a=Array.from({length:21},(_,i)=>c(i+1,100+i*.1,100.3+i*.1,99.8+i*.1,100.2+i*.1));
  a.push(c(22,102.2,110,102,109.8));
  const all=detectBbCandleV1(a);
  assert.ok(all.some(x=>x.type==="MARUBOZU"&&x.direction==="BUY"&&x.index===21));
  assert.deepEqual(detectBbCandleV1(a.slice(0,-1)),[]);
  assert.deepEqual(detectBbCandleV1([...a,c(23,109.8,111,90,91)]).filter(x=>x.index===21),all);
});
test("results not published at fewer than 30 mature examples",()=>{
  const a=Array.from({length:21},(_,i)=>c(i+1,100,101,99,100+i*.01));
  const report=evaluateBbCandleV1(a,[{type:"MARUBOZU",index:19,signalClose:100,direction:"BUY"}]);
  assert.equal(report[0].horizons[0].completed,1);
  assert.equal(report[0].horizons[0].winRatePct,null);
});
