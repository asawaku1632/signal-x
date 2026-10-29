import test from "node:test";import assert from "node:assert/strict";
import {auditPreopenWeekendPolicy as run} from "../app/lib/research/preopenWeekendPolicy.mjs";
const monday={capturedAt:"2026-10-26T08:45:00+09:00",quotes:{
 dow:{sourceTimestamp:"2026-10-23T13:30:00Z"},
 nasdaq:{sourceTimestamp:"2026-10-23T13:30:00Z"},
 usdJpy:{sourceTimestamp:"2026-10-25T23:45:00Z"}}};
test("Monday accepts Friday US references when within configured weekend window",()=>{const r=run(monday);assert.equal(r.eligible,true);assert.equal(r.appliedOverrides.dow,72);assert.equal(r.appliedOverrides.nasdaq,72);});
test("does not extend FX reference age",()=>{const r=run({...monday,quotes:{...monday.quotes,usdJpy:{sourceTimestamp:"2026-10-23T13:30:00Z"}}});assert.equal(r.eligible,false);assert.equal(r.quoteAudits[2].reason,"STALE_REFERENCE");});
test("no US index extension on Tuesday",()=>{const r=run({...monday,capturedAt:"2026-10-27T08:45:00+09:00"});assert.equal(r.eligible,false);assert.deepEqual(r.appliedOverrides,{});});
test("Monday source from Thursday does not receive extension",()=>{const r=run({...monday,quotes:{...monday.quotes,dow:{sourceTimestamp:"2026-10-22T13:30:00Z"}}});assert.equal(r.eligible,false);assert.equal(r.appliedOverrides.dow,undefined);});
test("future claimed source still rejected",()=>{const r=run({...monday,quotes:{...monday.quotes,dow:{sourceTimestamp:"2026-10-27T13:30:00Z"}}});assert.equal(r.eligible,false);assert.equal(r.quoteAudits[0].reason,"FUTURE_SOURCE_TIMESTAMP");});
test("invalid limits rejected",()=>assert.throws(()=>run(monday,{baseAgeHours:24,weekendIndexAgeHours:12}),/INVALID_WEEKEND_AGE_POLICY/));
test("missing quotes fail closed",()=>assert.equal(run({capturedAt:monday.capturedAt}).eligible,false));
test("no provider trust or signal permission",()=>{const r=run(monday);assert.equal(r.providerVerified,false);assert.equal(r.calendarVerified,false);assert.equal(r.signalEnabled,false);assert.equal(r.usableForTrading,false);});
