import test from "node:test";
import assert from "node:assert/strict";
import {parseTopixYahooDaily,captureTopix,TOPIX_CAPTURE_WINDOW} from "../scripts/research/capture-bb-topix.mjs";
import {isTseTradingDate} from "../app/lib/technicalObservation/tseMarketCalendar.ts";
// Enumerate the fixed historical fixture range one calendar day at a time.
// The calendar helper resolveTseTradingDatesAfter has a bounded lookahead
// and is intentionally not a generic 30-session historical generator.
const dates=[];
for(let ms=Date.parse(TOPIX_CAPTURE_WINDOW.first+"T00:00:00Z");
    ms<=Date.parse(TOPIX_CAPTURE_WINDOW.last+"T00:00:00Z");
    ms+=86400000){
  const day=new Date(ms).toISOString().slice(0,10);
  if(isTseTradingDate(day))dates.push(day);
}
const fixture=()=>({chart:{result:[{
 timestamp:dates.map(d=>Date.parse(d+"T15:00:00+09:00")/1000),
 indicators:{quote:[{close:dates.map((_,i)=>3000+i*2)}]}
}]}});
test("strict TOPIX daily chart validates calendar and boundaries",()=>{
 const data=parseTopixYahooDaily(fixture());
 assert.equal(data.benchmark,"TOPIX");
 assert.equal(data.closes.length,dates.length);
 assert.equal(data.first,TOPIX_CAPTURE_WINDOW.first);
 assert.equal(data.last,TOPIX_CAPTURE_WINDOW.last);
});
test("missing intermediate market session blocks",()=>{
 const x=fixture();
 x.chart.result[0].timestamp.splice(5,1);
 x.chart.result[0].indicators.quote[0].close.splice(5,1);
 assert.throws(()=>parseTopixYahooDaily(x),/MISSING_BENCHMARK_TRADING_DAY/);
});
test("one bounded request and no data source contacted in unit test",async()=>{
 let calls=0;
 const res=await captureTopix({fetchImpl:async(url,opts)=>{
   calls++;
   assert.match(url,/query1\.finance\.yahoo\.com\/v8\/finance\/chart\/998405\.T/);
   assert.equal(opts.redirect,"error");
   return {ok:true,json:async()=>fixture()};
 }});
 assert.equal(calls,1);
 assert.equal(res.closes.length,dates.length);
});
