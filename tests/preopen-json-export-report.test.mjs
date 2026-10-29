import test from "node:test";
import assert from "node:assert/strict";
import {analyzePreopenExportJson as run} from "../scripts/report-preopen-json-export.mjs";
const base={trade_date:"2026-10-26",captured_at:"2026-10-25 23:45:10.053+00",quotes:{
 dow:{sourceTimestamp:"2026-10-23T13:30:00Z"},
 nasdaq:{sourceTimestamp:"2026-10-23T13:30:00Z"},
 usdJpy:{sourceTimestamp:"2026-10-25T23:45:08Z"}
}};
test("manual approved JSON input follows adapter and policy",()=>{
 const x=run(JSON.stringify([base]));
 assert.equal(x.counts.validAgeOnly,1);
 assert.equal(x.liveDbAccess,false);
 assert.equal(x.authenticatedForPrediction,0);
});
test("stale FX excluded",()=>{
 const stale={...base,quotes:{...base.quotes,usdJpy:{sourceTimestamp:"2026-10-24T00:00:00Z"}}};
 assert.deepEqual(run(JSON.stringify([stale])).dates[0].reasons,["usdJpy:STALE_REFERENCE"]);
});
test("duplicate trade day excluded",()=>assert.equal(run(JSON.stringify([base,base])).counts.duplicateDate,1));
test("empty array accepted",()=>assert.equal(run("[]").counts.total,0));
test("non-array rejected",()=>assert.throws(()=>run("{}"),/EXPECTED_JSON_ARRAY/));
test("invalid JSON rejected",()=>assert.throws(()=>run("{oops"),SyntaxError));
test("oversized export rejected",()=>assert.throws(()=>run(" ".repeat(5*1024*1024+1)),/INVALID_PREOPEN_JSON_EXPORT/));
test("nonstring rejected",()=>assert.throws(()=>run(null),/INVALID_PREOPEN_JSON_EXPORT/));
