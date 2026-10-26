import test from "node:test";
import assert from "node:assert/strict";
import {analyzeMorningFailureFixtures as analyze} from "../app/lib/research/morningQuoteOfflinePipeline.mjs";

test("HTTP, timeout, parser and unknown fetch errors survive full offline aggregation",()=>{
 const timeout=new Error("timeout");timeout.name="TimeoutError";
 const x=analyze([
  {tradeDate:"2026-10-26",httpStatus:503},
  {tradeDate:"2026-10-26",error:timeout},
  {tradeDate:"2026-10-26",error:new SyntaxError("bad")},
  {tradeDate:"2026-10-26",error:new Error("offline")}
 ]);
 assert.equal(x.accepted,4);assert.equal(x.rejected,0);
 for(const reason of ["UPSTREAM_HTTP_ERROR","UPSTREAM_TIMEOUT","JSON_PARSE_ERROR","UPSTREAM_FETCH_ERROR"])
  assert.equal(x.counts[reason],1);
 assert.equal(x.persistenceEnabled,false);
 assert.equal(x.rootCauseConfirmed,false);
 assert.equal(x.priceValidityEstablished,false);
});
test("invalid calendar dates and absent dates are excluded",()=>{
 const x=analyze([{tradeDate:"2026-02-30",httpStatus:500},{tradeDate:"2026-10-26",httpStatus:500},{}]);
 assert.equal(x.accepted,1);assert.equal(x.rejected,2);
});
test("no fixtures do not establish a diagnosis",()=>{
 const x=analyze([]);
 assert.equal(x.accepted,0);assert.equal(x.rootCauseConfirmed,false);
});
test("reject non-array input",()=>assert.throws(()=>analyze({}),TypeError));
