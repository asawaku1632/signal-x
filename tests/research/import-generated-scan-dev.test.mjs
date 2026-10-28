import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
const executable=new URL("../../scripts/research/import-generated-scan-dev.mjs",import.meta.url);
function run(env={}) {
  return spawnSync(process.execPath,[executable.pathname],{
    encoding:"utf8",env:{...process.env,NODE_ENV:"test",SIGNALX_RESEARCH_DEV_WRITE:"false",
      SIGNALX_RESEARCH_SCAN_INPUT:"",DATABASE_URL:"",...env},timeout:15000
  });
}
test("offline importer is disabled by default without any DB connection",()=>{
 const result=run();
 assert.equal(result.status,1);
 assert.match(result.stderr,/RESEARCH_IMPORT_DISABLED/);
});
test("production importer remains disabled even with explicit write flag",()=>{
 const result=run({NODE_ENV:"production",SIGNALX_RESEARCH_DEV_WRITE:"true"});
 assert.equal(result.status,1);
 assert.match(result.stderr,/RESEARCH_IMPORT_DISABLED/);
});
test("development importer refuses nonabsolute input before connecting",()=>{
 const result=run({NODE_ENV:"development",SIGNALX_RESEARCH_DEV_WRITE:"true",
 SIGNALX_RESEARCH_SCAN_INPUT:"../cached.json"});
 assert.equal(result.status,1);
 assert.match(result.stderr,/ABSOLUTE_SCAN_INPUT_REQUIRED/);
});
test("development importer refuses non-development DB hostname before reading",()=>{
 const result=run({NODE_ENV:"development",SIGNALX_RESEARCH_DEV_WRITE:"true",
 SIGNALX_RESEARCH_SCAN_INPUT:"/no-such-scan.json",
 DATABASE_URL:"postgresql://postgres:pw@db.paygtakajhvatwejygda.supabase.co/postgres"});
 assert.equal(result.status,1);
 assert.match(result.stderr,/RESEARCH_DEV_DATABASE_NOT_VERIFIED/);
});

test("malformed source JSON cannot initiate a database connection",()=>{
 const result=run({NODE_ENV:"development",SIGNALX_RESEARCH_DEV_WRITE:"true",
 SIGNALX_RESEARCH_SCAN_INPUT:"/does-not-exist.json",
 DATABASE_URL:"postgresql://postgres:fake@db.jdtqwryiyxeuoraecorw.supabase.co/postgres"});
 assert.equal(result.status,1);
 assert.match(result.stderr,/ENOENT/);
 assert.doesNotMatch(result.stderr,/ECONNREFUSED|ENOTFOUND/);
});
