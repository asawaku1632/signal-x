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
test("non-array rejected",()=>assert.throws(()=>run("{}"),/EXPECTED_JSON_ARRAY_OR_APPROVED_PREOPEN_ROWS/));
test("invalid JSON rejected",()=>assert.throws(()=>run("{oops"),SyntaxError));
test("oversized export rejected",()=>assert.throws(()=>run(" ".repeat(5*1024*1024+1)),/INVALID_PREOPEN_JSON_EXPORT/));
test("nonstring rejected",()=>assert.throws(()=>run(null),/INVALID_PREOPEN_JSON_EXPORT/));

test("actual SQL single-object wrapper accepted",()=>{const x=run(JSON.stringify({approved_preopen_rows:[base]}));assert.equal(x.counts.validAgeOnly,1);});
test("SQL wrapper with extra metadata rejected",()=>assert.throws(()=>run(JSON.stringify({approved_preopen_rows:[base],unexpected:true})),/EXPECTED_JSON_ARRAY_OR_APPROVED_PREOPEN_ROWS/));

import {spawnSync} from "node:child_process";
import {mkdtempSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
test("real Node CLI reads reviewed seven-date SQL-shaped JSON and emits 4/3 screening",()=>{
 const dir=mkdtempSync(join(tmpdir(),"preopen-cli-"));
 try{
  const fixture=[
   ["2026-10-21","2026-10-20 23:45:09.525+00","2026-10-20T13:30:00.000Z","2026-10-20T23:00:00.000Z"],
   ["2026-10-22","2026-10-21 23:45:09.75+00","2026-10-21T13:30:00.000Z","2026-10-21T23:00:00.000Z"],
   ["2026-10-23","2026-10-22 23:45:10.053+00","2026-10-22T13:30:00.000Z","2026-10-22T23:00:00.000Z"],
   ["2026-10-26","2026-10-25 23:45:10.053+00","2026-10-23T13:30:00.000Z","2026-10-25T23:45:08.000Z"],
   ["2026-10-27","2026-10-26 23:45:10.298+00","2026-10-26T13:30:00.000Z","2026-10-26T00:00:00.000Z"],
   ["2026-10-28","2026-10-27 23:45:10.568+00","2026-10-27T13:30:00.000Z","2026-10-27T00:00:00.000Z"],
   ["2026-10-29","2026-10-28 23:45:09.673+00","2026-10-28T13:30:00.000Z","2026-10-28T00:00:00.000Z"]
  ].map(([trade_date,captured_at,indexTimestamp,fxTimestamp])=>({trade_date,captured_at,quotes:{
   dow:{sourceTimestamp:indexTimestamp},nasdaq:{sourceTimestamp:indexTimestamp},usdJpy:{sourceTimestamp:fxTimestamp}}}));
  const input=join(dir,"approved.json");
  writeFileSync(input,JSON.stringify({approved_preopen_rows:fixture}));
  const p=spawnSync(process.execPath,[resolve("scripts/report-preopen-json-export.mjs"),input],{encoding:"utf8",timeout:5000});
  assert.equal(p.status,0,p.stderr);
  const out=JSON.parse(p.stdout);
  assert.deepEqual([out.counts.total,out.counts.validAgeOnly,out.counts.ageOrSourceIssue],[7,4,3]);
  assert.equal(out.approvedForSignals,0);
  assert.equal(out.liveDbAccess,false);
  assert.deepEqual(out.dates.slice(4).map(x=>x.reasons[0]),Array(3).fill("usdJpy:STALE_REFERENCE"));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
