import test from "node:test";
import assert from "node:assert/strict";
import {adaptPreopenDbRows} from "../app/lib/research/preopenDbAdapter.mjs";
import {classifyPreopenResearchDates} from "../app/lib/research/preopenResearchPartition.mjs";
// Timestamp-only fixture transcribed from read-only DB SELECT on 2026-10-29.
// No prices, private data, or provider authentication is implied.
const captures=[
 ["2026-10-21","2026-10-20 23:45:09.525+00","2026-10-20T13:30:00.000Z","2026-10-20T23:00:00.000Z"],
 ["2026-10-22","2026-10-21 23:45:09.75+00","2026-10-21T13:30:00.000Z","2026-10-21T23:00:00.000Z"],
 ["2026-10-23","2026-10-22 23:45:10.053+00","2026-10-22T13:30:00.000Z","2026-10-22T23:00:00.000Z"],
 ["2026-10-26","2026-10-25 23:45:10.053+00","2026-10-23T13:30:00.000Z","2026-10-25T23:45:08.000Z"],
 ["2026-10-27","2026-10-26 23:45:10.298+00","2026-10-26T13:30:00.000Z","2026-10-26T00:00:00.000Z"],
 ["2026-10-28","2026-10-27 23:45:10.568+00","2026-10-27T13:30:00.000Z","2026-10-27T00:00:00.000Z"],
 ["2026-10-29","2026-10-28 23:45:09.673+00","2026-10-28T13:30:00.000Z","2026-10-28T00:00:00.000Z"],
];
const rows=captures.map(([trade_date,captured_at,us,fx])=>({
 trade_date,captured_at,quotes:{dow:{sourceTimestamp:us},nasdaq:{sourceTimestamp:us},usdJpy:{sourceTimestamp:fx}}
}));
test("all seven historical DB timestamp records partition consistently",()=>{
 const result=classifyPreopenResearchDates(adaptPreopenDbRows(rows));
 assert.deepEqual(result.counts,{total:7,validAgeOnly:4,excluded:3,duplicateDate:0,invalidDate:0,captureDateMismatch:0,ageOrSourceIssue:3});
 assert.deepEqual(result.dates.map(x=>x.status),[
  "AGE_SCREEN_ONLY","AGE_SCREEN_ONLY","AGE_SCREEN_ONLY","AGE_SCREEN_ONLY",
  "EXCLUDE_SOURCE_AGE","EXCLUDE_SOURCE_AGE","EXCLUDE_SOURCE_AGE"]);
 assert.equal(result.approvedForSignals,0);
 assert.equal(result.authenticatedForPrediction,0);
});
test("three stale records cite FX as exclusion cause",()=>{
 const result=classifyPreopenResearchDates(adaptPreopenDbRows(rows));
 for(const row of result.dates.slice(4))assert.deepEqual(row.reasons,["usdJpy:STALE_REFERENCE"]);
});
test("Monday Friday-source US reference receives only weekend age allowance",()=>{
 const result=classifyPreopenResearchDates(adaptPreopenDbRows([rows[3]]));
 assert.equal(result.dates[0].status,"AGE_SCREEN_ONLY");
});
