import test from "node:test";
import assert from "node:assert/strict";
import {auditExitBarCoverage} from "../app/lib/research/morningExitBarCoverage.mjs";
const time=x=>Math.floor(Date.parse("2026-10-30T"+x+":00+09:00")/1000);
const bar=x=>({time:time(x),open:100,high:101,low:99,close:100});
test("identifies exact missing 5m timestamps",()=>{
 const r=auditExitBarCoverage("2026-10-30",[bar("09:10"),bar("09:20")],{start:"09:10",end:"09:20"});
 assert.deepEqual(r.missing,["09:15"]);assert.equal(r.valid,2);assert.equal(r.complete,false);
});
test("invalid OHLC cannot count as observed valid low",()=>{
 const bad={...bar("09:15"),low:105};
 const r=auditExitBarCoverage("2026-10-30",[bar("09:10"),bad],{start:"09:10",end:"09:15"});
 assert.deepEqual(r.invalid,["09:15"]);assert.equal(r.complete,false);
});
test("break interval is not invented as missing bars",()=>{
 const r=auditExitBarCoverage("2026-10-30",[bar("11:25"),bar("12:30")],{start:"11:25",end:"12:30"});
 assert.equal(r.expected,2);assert.equal(r.complete,true);assert.equal(r.independentSourceVerified,false);
});
