import test from "node:test";import assert from "node:assert/strict";
import {auditPreopenMarketReference as audit} from "../app/lib/research/preopenReferenceAgeAudit.mjs";
const at="2026-10-29T08:45:00+09:00";
const make=(time)=>({capturedAt:at,quotes:{dow:{sourceTimestamp:time},nasdaq:{sourceTimestamp:time},usdJpy:{sourceTimestamp:time}}});
test("fresh claimed source accepted only as age arithmetic",()=>{const x=audit(make("2026-10-28T23:00:00Z"));assert.equal(x.eligible,true);assert.equal(x.verified,false);assert.equal(x.usableForTrading,false);});
test("one stale source fails closed",()=>{const x=make("2026-10-28T23:00:00Z");x.quotes.usdJpy.sourceTimestamp="2026-10-27T00:00:00Z";assert.equal(audit(x).eligible,false);});
test("future source rejected",()=>assert.equal(audit(make("2026-10-29T03:00:00Z")).quoteAudits[0].reason,"FUTURE_SOURCE_TIMESTAMP"));
test("missing source rejected",()=>assert.equal(audit(make(null)).eligible,false));
test("missing record rejected",()=>assert.equal(audit(null).reason,"INVALID_RECORD"));
test("no quote object rejected",()=>assert.equal(audit({capturedAt:at}).eligible,false));
test("invalid age limit rejected",()=>assert.throws(()=>audit(make(at),{maxAgeHours:0}),/INVALID_MARKET_AGE_LIMIT/));
test("tighter freshness window rejects",()=>assert.equal(audit(make("2026-10-28T23:00:00Z"),{maxAgeHours:0.5}).eligible,false));
test("naive timestamp rejected",()=>assert.equal(audit({...make(at),capturedAt:"2026-10-29T08:45:00"}).eligible,false));
test("future trading claim never issued",()=>assert.equal(audit(make(at)).usableForTrading,false));

test("weekend Dow reference can use explicit extended research window",()=>{const x=make("2026-10-26T08:00:00+09:00");x.quotes.dow.sourceTimestamp="2026-10-23T13:30:00Z";assert.equal(audit(x).eligible,false);assert.equal(audit(x,{maximumAgeByInstrument:{dow:72}}).eligible,true);});
test("stale FX not excused by Dow weekend allowance",()=>{const x=make("2026-10-28T23:00:00Z");x.quotes.usdJpy.sourceTimestamp="2026-10-27T00:00:00Z";assert.equal(audit(x,{maximumAgeByInstrument:{dow:72}}).eligible,false);});
test("invalid override rejected",()=>assert.throws(()=>audit(make(at),{maximumAgeByInstrument:{dow:-1}}),/INVALID_MARKET_AGE_LIMIT/));
test("array override rejected",()=>assert.throws(()=>audit(make(at),{maximumAgeByInstrument:[]}),/INVALID_MARKET_AGE_LIMIT/));
