import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const executable=new URL("../../scripts/research/import-completed-scan-execution-dev.mjs",import.meta.url);
function execute(time) {
 const dir=mkdtempSync(join(tmpdir(),"signalx-research-age-"));
 const path=join(dir,"scan.json");
 writeFileSync(path,JSON.stringify({scanCompletedAt:time}));
 try{
  return spawnSync(process.execPath,[executable.pathname],{
   encoding:"utf8",timeout:15000,
   env:{...process.env,NODE_ENV:"development",SIGNALX_RESEARCH_DEV_WRITE:"true",
     SIGNALX_RESEARCH_EXECUTION_INPUT:path,
     DATABASE_URL:"postgresql://postgres:fake@db.jdtqwryiyxeuoraecorw.supabase.co/postgres"}
  });
 } finally {rmSync(dir,{recursive:true,force:true});}
}
test("historical Scan artifact is rejected before any network connection",()=>{
 const x=execute("2026-01-01T00:00:00Z");
 assert.equal(x.status,1);
 assert.match(x.stderr,/SCAN_EXECUTION_NOT_RECENT/);
});
test("future-dated Scan artifact is rejected before any network connection",()=>{
 const x=execute("2099-01-01T00:00:00Z");
 assert.equal(x.status,1);
 assert.match(x.stderr,/SCAN_EXECUTION_NOT_RECENT/);
});
