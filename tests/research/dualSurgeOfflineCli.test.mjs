import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {mkdtempSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
const cli=new URL("../../scripts/dual-surge-offline-replay.mjs",import.meta.url).pathname;
const run=(...args)=>spawnSync(process.execPath,[cli,...args],{encoding:"utf8",timeout:10000});
test("offline CLI requires an explicit licensed snapshot path",()=>{
 const r=run();assert.equal(r.status,2);assert.match(r.stderr,/Usage:/);
});
test("offline CLI refuses unverified provider licensing",()=>{
 const dir=mkdtempSync(join(tmpdir(),"dual-surge-license-"));
 try{
  const file=join(dir,"snapshot.json");
  writeFileSync(file,JSON.stringify({source:"JQUANTS_V2",snapshotId:"fixture",licenseVerified:false,asOfDate:"2026-10-23",providerRowsByCode:{}}));
  const r=run(file);assert.equal(r.status,2);assert.match(r.stderr,/UNVERIFIED_LICENSE_OR_SNAPSHOT/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test("offline CLI rejects malformed JSON without provider access",()=>{
 const dir=mkdtempSync(join(tmpdir(),"dual-surge-invalid-"));
 try{
  const file=join(dir,"snapshot.json");writeFileSync(file,"{bad");
  const r=run(file);assert.equal(r.status,2);assert.match(r.stderr,/Unexpected token|Expected property name|JSON/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
