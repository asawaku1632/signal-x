import test from "node:test";
import assert from "node:assert/strict";
import {evaluateDowntrend} from "../app/lib/uptrendObservation.mjs";
const start=Date.parse("2026-11-09T09:00:00+09:00")/1000;
const bars=Array.from({length:26},(_,i)=>({time:start+i*300,open:200-i,close:199.5-i,high:201-i,low:199-i,volume:i>=23?200:100}));
const now=(bars.at(-1).time+300)*1000;
test("falling closes and highs with middle and volume qualify",()=>{
 const result=evaluateDowntrend(bars,now,"2026-11-09");
 assert.equal(result.matched,true);
 assert.equal(result.reason,"FALLING_CLOSES_HIGHS_MIDDLE_VOLUME");
});
test("incomplete bar is excluded",()=>assert.equal(evaluateDowntrend(bars,now-1,"2026-11-09").barTime,bars.at(-2).time));
test("stale, wrong-day and duplicate quotes are rejected",()=>{
 assert.equal(evaluateDowntrend(bars,now+21*60000,"2026-11-09").matched,false);
 assert.equal(evaluateDowntrend(bars,now,"2026-11-10").matched,false);
 assert.equal(evaluateDowntrend([...bars,bars.at(-1)],now,"2026-11-09").matched,false);
});
test("missing consecutive bar cannot trigger",()=>assert.equal(evaluateDowntrend(bars.filter((_,i)=>i!==24),now,"2026-11-09").matched,false));
test("low volume and rising last high cannot trigger",()=>{
 assert.equal(evaluateDowntrend(bars.map(b=>({...b,volume:100})),now,"2026-11-09").matched,false);
 assert.equal(evaluateDowntrend(bars.map((b,i)=>({...b,high:i===25?220:b.high})),now,"2026-11-09").matched,false);
});
test("a rising series does not trigger downtrend",()=>{
 const rising=bars.map((b,i)=>({...b,open:100+i,close:100.5+i,high:101+i,low:99+i}));
 assert.equal(evaluateDowntrend(rising,now,"2026-11-09").matched,false);
});
