import test from "node:test";
import assert from "node:assert/strict";
import {evaluateUptrend} from "../app/lib/uptrendObservation.mjs";
const start=Date.parse("2026-11-09T09:00:00+09:00")/1000;
const bars=Array.from({length:26},(_,i)=>({time:start+i*300,open:100+i,close:100.5+i,high:101+i,low:99+i,volume:i>=23?200:100}));
const now=(bars.at(-1).time+300)*1000;
test("confirmed rising bars and volume qualify",()=>assert.equal(evaluateUptrend(bars,now,"2026-11-09").matched,true));
test("incomplete bar is excluded",()=>assert.equal(evaluateUptrend(bars,now-1,"2026-11-09").barTime,bars.at(-2).time));
test("stale or wrong-day bars cannot trigger",()=>{
 assert.equal(evaluateUptrend(bars,now+21*60000,"2026-11-09").matched,false);
 assert.equal(evaluateUptrend(bars,now,"2026-11-10").matched,false);
});
test("missing and duplicate bars cannot trigger",()=>{
 assert.equal(evaluateUptrend([...bars,bars.at(-1)],now,"2026-11-09").matched,false);
 assert.equal(evaluateUptrend(bars.filter((_,i)=>i!==24),now,"2026-11-09").matched,false);
});
test("flat volume and falling lows cannot trigger",()=>{
 assert.equal(evaluateUptrend(bars.map(b=>({...b,volume:100})),now,"2026-11-09").matched,false);
 assert.equal(evaluateUptrend(bars.map((b,i)=>({...b,low:i===25?90:b.low})),now,"2026-11-09").matched,false);
});
