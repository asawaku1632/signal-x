import test from "node:test";import assert from "node:assert/strict";
import {auditRetrospectiveBenchmarkCoverage as run} from "../app/lib/research/retrospectiveBenchmarkCoverage.mjs";
const row={trade_date:"2026-10-22",nikkei_close:62907.83984375,nikkei_previous_close:64621.23828125};
test("real saved single Nikkei date insufficient for regime inference",()=>{const x=run([row]);assert.equal(x.validDates,1);assert.equal(x.representedMonths,1);assert.ok(x.blockers.includes("INSUFFICIENT_BENCHMARK_DATES"));assert.equal(x.regimeValidated,false);});
test("duplicate cannot inflate sample",()=>{const x=run([row,row]);assert.equal(x.duplicates,1);assert.equal(x.validDates,1);});
test("bad prices rejected",()=>assert.equal(run([{...row,nikkei_close:0}]).invalid,1));
test("impossible date rejected",()=>assert.equal(run([{...row,trade_date:"2026-11-31"}]).invalid,1));
test("large sample cannot attest its own source",()=>{const rows=Array.from({length:30},(_,i)=>({...row,trade_date:"2026-"+String(Math.floor(i/10)+1).padStart(2,"0")+"-"+String(i%10+1).padStart(2,"0")}));const x=run(rows);assert.equal(x.validDates,30);assert.ok(x.blockers.includes("INDEPENDENT_SOURCE_AND_AS_OF_ATTESTATION_MISSING"));assert.equal(x.readyForSignals,false);});
test("reject invalid options",()=>assert.throws(()=>run([row],{minimumDates:1}),/INVALID_BENCHMARK_COVERAGE/));
