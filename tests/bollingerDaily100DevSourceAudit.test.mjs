import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import ts from "typescript";
const source=readFileSync("app/lib/research/bollingerDaily100DevSourceAudit.ts","utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
let called=0;
const exports={};
new Function("require","exports",js)((name)=>{
 if(name==="./bollingerDaily100PartitionProcessor")
  return {processDaily100Partition:async args=>{
    called++;return {partitionId:args.partitionId,requested:20,observed:20,failed:0,status:"COMPLETE",checks:[]};
  }};
 return {};
},exports);
const run=exports.runDaily100DevSourceAudit;
test("disabled claim cannot start source requests",async()=>{
 called=0;let fetched=0;
 const out=await run({tradeDate:"2026-10-21",partitionId:0,
   claim:async()=>({state:"DISABLED"}),
   fetchCompletedDaily:async()=>{fetched++;},
   validateCompletedDaily:()=>true,persistChecks:async()=>{}});
 assert.deepEqual(out,{state:"SKIPPED",reason:"DISABLED"});
 assert.equal(called,0);assert.equal(fetched,0);
});
test("invalid date or partition rejects before claim",async()=>{
 called=0;let claimed=0;
 await assert.rejects(run({tradeDate:"invalid",partitionId:0,
  claim:async()=>{claimed++;return {state:"DISABLED"};},
  fetchCompletedDaily:async()=>{},validateCompletedDaily:()=>true,persistChecks:async()=>{}}),/REQUEST_INVALID/);
 assert.equal(claimed,0);
});
test("valid claim invokes isolated processor once",async()=>{
 called=0;
 const out=await run({tradeDate:"2026-10-21",partitionId:0,
  claim:async()=>({state:"CLAIMED",key:"k",codes:Array(20).fill("1300")}),
  fetchCompletedDaily:async()=>{},validateCompletedDaily:()=>true,persistChecks:async()=>{}});
 assert.equal(out.state,"AUDITED");assert.equal(called,1);
});
