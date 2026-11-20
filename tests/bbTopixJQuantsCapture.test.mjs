import test from "node:test";
import assert from "node:assert/strict";
import {TOPIX_JQUANTS_WINDOW,TOPIX_JQUANTS_URL,validateTopixJQuantsPages,captureTopixJQuants} from "../scripts/research/capture-bb-topix-jquants.mjs";
import {isTseTradingDate} from "../app/lib/technicalObservation/tseMarketCalendar.ts";
const dates=[];
for(let ms=Date.parse(TOPIX_JQUANTS_WINDOW.first+"T00:00:00Z");ms<=Date.parse(TOPIX_JQUANTS_WINDOW.last+"T00:00:00Z");ms+=86400000){
 const d=new Date(ms).toISOString().slice(0,10);
 if(isTseTradingDate(d))dates.push(d);
}
const rows=dates.map((d,i)=>({Date:d,C:4000+i,O:4000+i,H:4002+i,L:3998+i}));
test("TOPIX J-Quants daily rows must be contiguous and exact",()=>{
 const d=validateTopixJQuantsPages([{data:rows}]);
 assert.equal(d.closes.length,dates.length);
 assert.equal(d.first,TOPIX_JQUANTS_WINDOW.first);
 assert.equal(d.last,TOPIX_JQUANTS_WINDOW.last);
});
test("missing, duplicate, and nonfinite rows never silently used",()=>{
 assert.throws(()=>validateTopixJQuantsPages([{data:rows.filter((_,i)=>i!==7)}]),/MISSING_BENCHMARK_TRADING_DAY/);
 assert.throws(()=>validateTopixJQuantsPages([{data:[...rows,rows[0]]}]),/DUPLICATE_TOPIX_DATE/);
 assert.throws(()=>validateTopixJQuantsPages([{data:rows.map((r,i)=>i===5?{...r,C:null}:r)}]),/INVALID_TOPIX_PROVIDER_ROW/);
});
test("capturer makes bounded authorized one GET, no actual network in test",async()=>{
 let calls=0;
 const d=await captureTopixJQuants({apiKey:"fake-test-only",fetchImpl:async(url,options)=>{
   calls++;
   assert.equal(url.origin+url.pathname,TOPIX_JQUANTS_URL);
   assert.equal(url.searchParams.get("from"),TOPIX_JQUANTS_WINDOW.first);
   assert.equal(url.searchParams.get("to"),TOPIX_JQUANTS_WINDOW.last);
   assert.equal(options.headers["x-api-key"],"fake-test-only");
   return {ok:true,json:async()=>({data:rows,pagination_key:null})};
 }});
 assert.equal(calls,1);
 assert.equal(d.closes.length,dates.length);
});
