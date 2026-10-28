import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
const executable = new URL("../../scripts/research/import-completed-scan-execution-dev.mjs",import.meta.url);
function run(env={}) {
 return spawnSync(process.execPath,[executable.pathname],{encoding:"utf8",timeout:15000,
 env:{...process.env,NODE_ENV:"test",SIGNALX_RESEARCH_DEV_WRITE:"false",SIGNALX_RESEARCH_EXECUTION_INPUT:"",DATABASE_URL:"",SIGNALX_RESEARCH_PROVIDER_PERMISSION_CONFIRMED:"false",...env}});
}
test("completed Scan importer does not run unless explicitly enabled",()=>{
 const x=run();assert.equal(x.status,1);assert.match(x.stderr,/RESEARCH_IMPORT_DISABLED/);
});
test("completed Scan importer rejects production mode",()=>{
 const x=run({NODE_ENV:"production",SIGNALX_RESEARCH_DEV_WRITE:"true"});
 assert.equal(x.status,1);assert.match(x.stderr,/RESEARCH_IMPORT_DISABLED/);
});
test("completed Scan importer rejects relative input paths before connection",()=>{
 const x=run({NODE_ENV:"development",SIGNALX_RESEARCH_DEV_WRITE:"true",
 SIGNALX_RESEARCH_PROVIDER_PERMISSION_CONFIRMED:"true",SIGNALX_RESEARCH_EXECUTION_INPUT:"../scan.json"});
 assert.equal(x.status,1);assert.match(x.stderr,/ABSOLUTE_EXECUTION_INPUT_REQUIRED/);
});
test("completed Scan importer rejects other database projects",()=>{
 const x=run({NODE_ENV:"development",SIGNALX_RESEARCH_DEV_WRITE:"true",
 SIGNALX_RESEARCH_PROVIDER_PERMISSION_CONFIRMED:"true",SIGNALX_RESEARCH_EXECUTION_INPUT:"/not-present.json",
 DATABASE_URL:"postgresql://postgres:pw@db.example.supabase.co/postgres"});
 assert.equal(x.status,1);assert.match(x.stderr,/RESEARCH_DEV_DATABASE_NOT_VERIFIED/);
});

test("offline importer refuses undocumented source permission before file read or connection",()=>{
 const x=run({NODE_ENV:"development",SIGNALX_RESEARCH_DEV_WRITE:"true",SIGNALX_RESEARCH_EXECUTION_INPUT:"/not-present.json",DATABASE_URL:"postgresql://postgres:fake@db.jdtqwryiyxeuoraecorw.supabase.co/postgres"});
 assert.equal(x.status,1);assert.match(x.stderr,/RESEARCH_PROVIDER_PERMISSION_NOT_CONFIRMED/);
});
