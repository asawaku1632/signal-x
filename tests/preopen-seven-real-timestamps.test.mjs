import test from "node:test";
import assert from "node:assert/strict";
import {adaptPreopenDbRows} from "../app/lib/research/preopenDbAdapter.mjs";
import {classifyPreopenResearchDates} from "../app/lib/research/preopenResearchPartition.mjs";
// Read-only DB snapshot transcribed on 2026-10-29. Only essential temporal fields.
const samples=[
["2026-10-21","2026-10-20 23:45:09.525+00","2026-10-20T13:30:00.000Z","2026-10-20T23:00:00.000Z"],
["2026-10-22","2026-10-21 23:45:09.75+00","2026-10-21T13:30:00.000Z","2026-10-21T23:00:00.000Z"],
["2026-10-23","2026-10-22 23:45:10.053+00","2026-10-22T13:30:00.000Z","2026-10-22T23:00:00.000Z"],
["2026-10-26","2026-10-25 23:45:10.053+00","2026-10-23T13:30:00.000Z","2026-10-25T23:45:08.000Z"],
["2026-10-27","2026-10-26 23:45:10.298+00","2026-10-26T13:30:00.000Z","2026-10-26T00:00:00.000Z"],
["2026-10-28","2026-10-27 23:45:10.568+00","2026-10-27T13:30:00.000Z","2026-10-27T00:00:00.000Z"],
["2026-10-29","2026-10-28 23:45:09.673+00","2026-10-28T13:30:00.000Z","2026-10-28T00:00:00.000Z"],
];
const rows=samples.map(([trade_date,captured_at,us,fx])=>({
 trade_date,captured_at,quotes:{dow:{sourceTimestamp:us},nasdaq:{sourceTimestamp:us},usdJpy:{sourceTimestamp:fx}}
}));
test("seven observed DB timestamps are classified by the actual offline adapter and partition",()=>{
 const result=classifyPreopenResearchDates(adaptPreopenDbRows(rows));
 assert.equal(result.counts.total,7);
 assert.equal(result.counts.validAgeOnly,4);
 assert.equal(result.counts.ageOrSourceIssue,3);
 assert.equal(result.counts.captureDateMismatch,0);
 assert.equal(result.authenticatedForPrediction,0);
 assert.equal(result.approvedForSignals,0);
 assert.deepEqual(result.dates.map(x=>[x.date,x.status]),[
 ["2026-10-21","AGE_SCREEN_ONLY"],["2026-10-22","AGE_SCREEN_ONLY"],
 ["2026-10-23","AGE_SCREEN_ONLY"],["2026-10-26","AGE_SCREEN_ONLY"],
 ["2026-10-27","EXCLUDE_SOURCE_AGE"],["2026-10-28","EXCLUDE_SOURCE_AGE"],
 ["2026-10-29","EXCLUDE_SOURCE_AGE"]]);
 for(const x of result.dates.slice(4))assert.deepEqual(x.reasons,["usdJpy:STALE_REFERENCE"]);
});
