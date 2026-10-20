import test from "node:test";
import assert from "node:assert/strict";
import {parseDailyMarketQuote,interpretOpeningGap,EXTERNAL_MARKET_SYMBOLS}
  from "../app/lib/research/morningExternalContext.mjs";
const now=new Date("2026-10-21T00:00:00Z");
function chart(values,timestamps){
  return {chart:{result:[{timestamp:timestamps,
    indicators:{quote:[{close:values}]}}]}};
}
test("market comparison never treats missing prices as zero",()=>{
  assert.equal(parseDailyMarketQuote(chart([null,101],[1792454400,1792540800]),"America/New_York",now),null);
  assert.equal(parseDailyMarketQuote({}, "America/New_York",now),null);
});
test("reads two dated references and marks stale data",()=>{
  const data=chart([100,102],[Date.parse("2026-10-19")/1000,Date.parse("2026-10-20")/1000]);
  const recent=parseDailyMarketQuote(data,"Asia/Tokyo",now);
  assert.equal(recent.price,102);
  assert.equal(recent.changePct,2);
  assert.equal(recent.state,"REFERENCE");
  assert.equal(recent.quoteDate,"2026-10-20");
  assert.equal(parseDailyMarketQuote(data,"Asia/Tokyo",new Date("2026-11-05")).state,"STALE");
});
test("gap rebound is descriptive and never returns a buy recommendation",()=>{
  const bounce=interpretOpeningGap(1000,975,983);
  assert.equal(bounce.state,"DOWN_REBOUND");
  assert.equal(bounce.gapPct,-2.5);
  assert.equal(interpretOpeningGap(1000,975,960).state,"DOWN_CONTINUES");
  assert.equal(interpretOpeningGap(1000,null,970),null);
  assert.equal(Object.hasOwn(bounce,"buyRecommendation"),false);
});
test("separate symbols include US indexes and JPY",()=>{
  assert.deepEqual(EXTERNAL_MARKET_SYMBOLS.map(m=>m.key),["dow","nasdaq","usdJpy"]);
});
