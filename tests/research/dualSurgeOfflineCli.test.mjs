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

test("offline CLI rejects a licensed-looking snapshot with an incomplete event reference",()=>{
 const dir=mkdtempSync(join(tmpdir(),"dual-surge-reference-"));
 try{
  const snapshot=join(dir,"snapshot.json"),reference=join(dir,"reference.json");
  writeFileSync(snapshot,JSON.stringify({source:"JQUANTS_V2",snapshotId:"fixture",licenseVerified:true,asOfDate:"2026-10-23",providerRowsByCode:{}}));
  writeFileSync(reference,JSON.stringify({source:"USER_PROVIDED_JQUANTS_V2_READ_ONLY_HISTORICAL_DIAGNOSTICS",events:[]}));
  const r=run(snapshot,reference);
  assert.equal(r.status,2);
  assert.match(r.stderr,/INVALID_EVENT_REFERENCE/);
  assert.equal(r.stdout,"");
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test("offline CLI rejects wrong provider source even when license flag is true",()=>{
 const dir=mkdtempSync(join(tmpdir(),"dual-surge-provider-"));
 try{
  const snapshot=join(dir,"snapshot.json"),reference=join(dir,"reference.json");
  writeFileSync(snapshot,JSON.stringify({source:"UNKNOWN",snapshotId:"fixture",licenseVerified:true,asOfDate:"2026-10-23",providerRowsByCode:{}}));
  writeFileSync(reference,JSON.stringify({source:"USER_PROVIDED_JQUANTS_V2_READ_ONLY_HISTORICAL_DIAGNOSTICS",events:[]}));
  const r=run(snapshot,reference);
  assert.equal(r.status,2);
  assert.match(r.stderr,/UNVERIFIED_LICENSE_OR_SNAPSHOT/);
  assert.equal(r.stdout,"");
 }finally{rmSync(dir,{recursive:true,force:true});}
});
