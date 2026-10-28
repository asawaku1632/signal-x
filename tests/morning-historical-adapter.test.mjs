import test from "node:test";
import assert from "node:assert/strict";
import {adaptHistoricalMorning,aggregateHistoricalMorning} from "../app/lib/research/morningHistoricalAdapter.mjs";
const bars=Array.from({length:30},(_,i)=>({
  time:Date.parse("2026-10-28T09:00:00+09:00")/1000+i*300,
  open:100,high:i>8?104:101,low:i===8?90:98,close:100
}));
const input={code:"590A",tradeDate:"2026-10-28",previousClose:100,
  intervalMinutes:5,bars,source:"LICENSED_TEST_FIXTURE",licenseVerified:true,
  timestampSemantics:"BAR_START",exchangeTimezone:"Asia/Tokyo"};
test("offline JST adapter extracts historical bottom and aggregates",()=>{
  const outcome=adaptHistoricalMorning(input);
  assert.equal(outcome.valid,true);
  assert.equal(outcome.bottomWindow,"09:40");
  const stats=aggregateHistoricalMorning([input],{minSamples:1,dropThresholdPct:2});
  assert.equal(stats.samples,1);
  assert.equal(stats.topWindows[0].windowStart,"09:40");
  assert.equal(stats.rebound2pct.rate,100);
});
test("fail closed on missing license, timestamp semantics, or incomplete bars",()=>{
  assert.equal(adaptHistoricalMorning({...input,licenseVerified:false}).valid,false);
  assert.equal(adaptHistoricalMorning({...input,timestampSemantics:"BAR_END"}).valid,false);
  assert.equal(adaptHistoricalMorning({...input,bars:bars.slice(1)}).valid,false);
});
