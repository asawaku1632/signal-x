import test from "node:test";
import assert from "node:assert/strict";
import { fetchBbResearchJquantsBars as fetchBars } from "../app/lib/research/dailyForwardBbJquantsResearchFetcher.mjs";
test("explicit opt in and server key required",async()=>{
 assert.equal((await fetchBars()).reason,"EXPLICIT_OPT_IN_REQUIRED");
 assert.equal((await fetchBars({enabled:true})).reason,"MISSING_SERVER_API_KEY");
});
test("bounded three-code requests do not expose API key",async()=>{
 const calls=[];
 const fake=async(url,options)=>{
  calls.push({url,options});
  const code=new URL(url).searchParams.get("code");
  return {ok:true,json:async()=>({data:[{Code:code,Date:"2026-08-28",C:100}]})};
 };
 const result=await fetchBars({enabled:true,apiKey:"test-secret",fetchImpl:fake});
 assert.equal(result.status,"RESEARCH_ONLY_BARS_FETCHED");
 assert.equal(calls.length,3);
 assert.deepEqual(calls.map(c=>new URL(c.url).searchParams.get("code")),["8591","9432","9983"]);
 assert.ok(calls.every(c=>!c.url.includes("test-secret")));
 assert.equal(result.productionWrites,false);
});
test("provider failures and pagination fail closed without partial results",async()=>{
 const fail=async()=>({ok:false,status:429});
 assert.equal((await fetchBars({enabled:true,apiKey:"x",fetchImpl:fail})).reason,"RATE_LIMITED");
 const paginated=async()=>({ok:true,json:async()=>({data:[],pagination_key:"next"})});
 assert.equal((await fetchBars({enabled:true,apiKey:"x",fetchImpl:paginated})).reason,"PAGINATION_UNSUPPORTED");
});

test("five-character common-stock provider codes normalize to research four-digit codes",async()=>{
 const fake=async(url)=>({ok:true,json:async()=>({data:[{
  Code:new URL(url).searchParams.get("code")+"0",Date:"2026-08-28",C:105
 }]})});
 const result=await fetchBars({enabled:true,apiKey:"test-only",fetchImpl:fake});
 assert.equal(result.status,"RESEARCH_ONLY_BARS_FETCHED");
 assert.equal(result.barsByCode["9432"][0].Code,"9432");
});
