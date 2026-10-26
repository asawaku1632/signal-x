import test from "node:test";
import assert from "node:assert/strict";
import {classifyMorningQuoteFailure as classify} from "../app/lib/research/morningQuoteFailureMetadata.mjs";
test("HTTP 503 is distinct from network errors",()=>{
 const x=classify({httpStatus:503});
 assert.equal(x.reason,"UPSTREAM_HTTP_ERROR");assert.equal(x.http_status_class,"5xx");
 assert.equal(x.price_validated,false);
});
test("timeout and abort are separately identified",()=>{
 for(const name of ["TimeoutError","AbortError"]){
  const e=new Error("hidden");e.name=name;
  assert.equal(classify({error:e}).reason,"UPSTREAM_TIMEOUT");
 }
});
test("JSON parsing failure is distinct",()=>{
 assert.equal(classify({error:new SyntaxError("unexpected")}).reason,"JSON_PARSE_ERROR");
});
test("unknown transport error remains unknown, not a successful quote",()=>{
 const x=classify({error:new Error("failed")});
 assert.equal(x.reason,"UPSTREAM_FETCH_ERROR");
 assert.equal(x.timestamp_count,null);assert.equal(x.has_0905,null);
});
test("no sensitive input is returned",()=>{
 const x=classify({httpStatus:429,code:"1234",price:999,userId:"secret"});
 assert.deepEqual(Object.keys(x).sort(),["stage","reason","http_status_class","timestamp_count","has_0900","has_0905","classifier_version","price_validated"].sort());
 assert.ok(Object.isFrozen(x));
});
