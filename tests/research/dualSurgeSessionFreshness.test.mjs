import test from "node:test";
import assert from "node:assert/strict";
import {assessSessionFreshness} from "../../app/lib/research/dualSurgeSessionFreshness.mjs";
const valid=()=>({exchangeDate:"2026-10-23",sessionDate:"2026-10-23",sourceTimestamp:"2026-10-23T06:10:00Z",asOf:"2026-10-23T06:20:00Z",calendarVerified:true,sessionCompleted:true,maximumAgeMinutes:30});
test("complete synthetic session passes freshness precheck only",()=>{const r=assessSessionFreshness(valid());assert.equal(r.available,true);assert.equal(r.productionApproved,false);});
test("missing timestamps block",()=>assert.ok(assessSessionFreshness({...valid(),sourceTimestamp:undefined}).reasons.includes("TIMESTAMP_UNAVAILABLE")));
test("stale source blocks",()=>assert.ok(assessSessionFreshness({...valid(),asOf:"2026-10-23T07:00:00Z"}).reasons.includes("STALE_DATA")));
test("future source blocks",()=>assert.ok(assessSessionFreshness({...valid(),asOf:"2026-10-23T06:00:00Z"}).reasons.includes("FUTURE_TIMESTAMP")));
test("calendar not verified blocks",()=>assert.ok(assessSessionFreshness({...valid(),calendarVerified:false}).reasons.includes("CALENDAR_UNVERIFIED")));
test("incomplete session blocks",()=>assert.ok(assessSessionFreshness({...valid(),sessionCompleted:false}).reasons.includes("SESSION_INCOMPLETE")));
test("missing observation blocks",()=>assert.ok(assessSessionFreshness({...valid(),missing:true}).reasons.includes("MISSING_DATA")));
test("duplicate observation blocks",()=>assert.ok(assessSessionFreshness({...valid(),duplicate:true}).reasons.includes("DUPLICATE_DATA")));
test("date mismatch blocks",()=>assert.ok(assessSessionFreshness({...valid(),sessionDate:"2026-10-22"}).reasons.includes("SESSION_DATE_MISMATCH")));
test("invalid calendar date blocks",()=>assert.ok(assessSessionFreshness({...valid(),exchangeDate:"2026-02-30"}).reasons.includes("SESSION_DATE_MISMATCH")));
test("source from other session blocks",()=>assert.ok(assessSessionFreshness({...valid(),sourceTimestamp:"2026-10-22T06:10:00Z"}).reasons.includes("SOURCE_SESSION_DATE_MISMATCH")));
test("invalid freshness threshold blocks",()=>assert.ok(assessSessionFreshness({...valid(),maximumAgeMinutes:0}).reasons.includes("INVALID_FRESHNESS_LIMIT")));

test("Tokyo session date accepts previous UTC calendar day",()=>{
 const r=assessSessionFreshness({...valid(),exchangeDate:"2026-10-24",sessionDate:"2026-10-24",sourceTimestamp:"2026-10-23T23:50:00Z",asOf:"2026-10-24T00:00:00Z"});
 assert.equal(r.available,true);
});
test("Tokyo session date rejects next-day mismatch",()=>{
 const r=assessSessionFreshness({...valid(),sourceTimestamp:"2026-10-23T23:50:00Z",asOf:"2026-10-24T00:00:00Z"});
 assert.ok(r.reasons.includes("SOURCE_SESSION_DATE_MISMATCH"));
});
