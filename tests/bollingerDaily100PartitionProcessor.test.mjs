import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source=readFileSync("app/lib/research/bollingerDaily100PartitionProcessor.ts","utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};
new Function("require","exports",js)((name)=>{
  if(name==="./bollingerDaily100Plan")return {DAILY_100_MAX_CONCURRENCY:3,DAILY_100_SOURCE_TIMEOUT_MS:12000};
  throw Error("UNEXPECTED_IMPORT:"+name);
},exports);
const run=exports.processDaily100Partition;
const codes=Array.from({length:20},(_,i)=>String(1300+i));
const base={partitionId:0,codes,claimed:true,timeoutMs:100,validateCompletedDaily:()=>true};

test("unclaimed partition never fetches or persists",async()=>{
 let fetches=0,saves=0;
 await assert.rejects(run({...base,claimed:false,fetchCompletedDaily:async()=>{fetches++;},persistChecks:async()=>{saves++;}}),/UNCLAIMED/);
 assert.equal(fetches,0);assert.equal(saves,0);
});
test("20 successes, bounded concurrency, one persisted audit",async()=>{
 let active=0,max=0,saved;
 const result=await run({...base,fetchCompletedDaily:async()=>{active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,1));active--;return {};},persistChecks:async r=>{saved=r;}});
 assert.equal(result.status,"COMPLETE");assert.equal(result.observed,20);
 assert.ok(max<=3);assert.deepEqual(saved,result);
});
test("failed fetch and incomplete bar yield PARTIAL with 20 checks",async()=>{
 const result=await run({...base,fetchCompletedDaily:async code=>{if(code===codes[0])throw Error("NO_SOURCE");return {};},validateCompletedDaily:code=>code!==codes[1],persistChecks:async()=>{}});
 assert.equal(result.status,"PARTIAL");assert.equal(result.failed,2);
 assert.equal(result.checks[0].state,"SOURCE_FAILED");
 assert.equal(result.checks[1].note,"SOURCE_NOT_COMPLETED");
});
test("all failed never reports COMPLETE",async()=>{
 const result=await run({...base,fetchCompletedDaily:async()=>{throw Error("FAIL");},persistChecks:async()=>{}});
 assert.equal(result.status,"FAILED");assert.equal(result.failed,20);
});
test("audit write failure propagates",async()=>{
 await assert.rejects(run({...base,fetchCompletedDaily:async()=>({}),persistChecks:async()=>{throw Error("AUDIT_FAILED");}}),/AUDIT_FAILED/);
});
test("invalid code and partition fail before fetching",async()=>{
 await assert.rejects(run({...base,codes:[...codes.slice(0,19),"BAD!"],fetchCompletedDaily:async()=>{},persistChecks:async()=>{}}),/INVALID_PARTITION/);
});

test("timeout aborts in-flight calls and prevents dispatching remaining codes",async()=>{
 let calls=0,aborts=0;
 const result=await run({...base,timeoutMs:5,
  fetchCompletedDaily:async(_code,signal)=>{
   calls++;
   return new Promise((_resolve,reject)=>{
    signal.addEventListener("abort",()=>{aborts++;reject(Error("ABORTED"));},{once:true});
   });
  },persistChecks:async()=>{}});
 assert.equal(result.status,"FAILED");
 assert.equal(result.checks.length,20);
 assert.equal(result.failed,20);
 assert.ok(calls<=3);
 assert.equal(aborts,calls);
 assert.ok(result.checks.some(c=>c.note==="STOPPED_AFTER_TIMEOUT"));
});
