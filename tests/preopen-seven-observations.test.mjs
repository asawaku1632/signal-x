import test from "node:test";import assert from "node:assert/strict";
import {adaptPreopenDbRows} from "../app/lib/research/preopenDbAdapter.mjs";
import {classifyPreopenResearchDates} from "../app/lib/research/preopenResearchPartition.mjs";
// Seven timestamp-only observations manually transcribed from SELECT-only DB inspection on 2026-10-29.
// These are saved reference timestamp claims, not provider-authenticated quote histories.
const samples=[
["2026-10-21","2026-10-20 23:45:09.525+00","2026-10-20T13:30:00.000Z","2026-10-20T23:00:00.000Z"],
["2026-10-22","2026-10-21 23:45:09.75+00","2026-10-21T13:30:00.000Z","2026-10-21T23:00:00.000Z"],
["2026-10-23","2026-10-22 23:45:10.053+00","2026-10-22T13:30:00.000Z","2026-10-22T23:00:00.000Z"],
["2026-10-26","2026-10-25 23:45:10.053+00","2026-10-23T13:30:00.000Z","2026-10-25T23:45:08.000Z"],
["2026-10-27","2026-10-26 23:45:10.298+00","2026-10-26T13:30:00.000Z","2026-10-26T00:00:00.000Z"],
["2026-10-28","2026-10-27 23:45:10.568+00","2026-10-27T13:30:00.000Z","2026-10-27T00:00:00.000Z"],
["2026-10-29","2026-10-28 23:45:09.673+00","2026-10-28T13:30:00.000Z","2026-10-28T00:00:00.000Z"],
];
const dbRows=samples.map(([trade_date,captured_at,indexTime,fxTime])=>({trade_date,captured_at,
 quotes:{dow:{sourceTimestamp:indexTime},nasdaq:{sourceTimestamp:indexTime},usdJpy:{sourceTimestamp:fxTime}}}));
test("all seven saved DB records run through actual adapter and classification",()=>{
 const result=classifyPreopenResearchDates(adaptPreopenDbRows(dbRows));
 assert.equal(result.counts.total,7);assert.equal(result.counts.validAgeOnly,4);
 assert.equal(result.counts.ageOrSourceIssue,3);assert.equal(result.counts.excluded,3);
 assert.deepEqual(result.dates.filter(x=>x.status==="AGE_SCREEN_ONLY").map(x=>x.date),["2026-10-21","2026-10-22","2026-10-23","2026-10-26"]);
 assert.deepEqual(result.dates.filter(x=>x.status==="EXCLUDE_SOURCE_AGE").map(x=>x.date),["2026-10-27","2026-10-28","2026-10-29"]);
 assert.ok(result.dates.filter(x=>x.status==="EXCLUDE_SOURCE_AGE").every(x=>x.reasons.includes("usdJpy:STALE_REFERENCE")));
 assert.equal(result.authenticatedForPrediction,0);assert.equal(result.approvedForSignals,0);
});
