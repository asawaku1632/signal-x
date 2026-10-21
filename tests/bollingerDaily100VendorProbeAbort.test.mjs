import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import ts from "typescript";
const js=ts.transpileModule(readFileSync("app/lib/research/bollingerDaily100VendorProbe.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};
new Function("require","exports",js)(()=>{throw Error("UNEXPECTED_IMPORT");},exports);
const probe=exports.probeDaily100Vendor;
test("timeout aborts fetch and does not dispatch remaining vendor calls",async()=>{
 let calls=0,aborts=0;
 const r=await probe(["1300","1301","1302"],async(_code,signal)=>{
   calls++;
   return new Promise((_resolve,reject)=>{
     signal.addEventListener("abort",()=>{aborts++;reject(Error("ABORTED"));},{once:true});
   });
 },{timeoutMs:5});
 assert.equal(calls,1);
 assert.equal(aborts,1);
 assert.equal(r.failed,3);
 assert.equal(r.checks.length,3);
 assert.ok(r.checks.slice(1).every(c=>c.error==="STOPPED_AFTER_TIMEOUT"));
});
test("probe rejects budget over five before fetching",async()=>{
 let calls=0;
 await assert.rejects(probe(["1300","1301","1302","1303","1304","1305"],async()=>{calls++;}),/BUDGET_INVALID/);
 assert.equal(calls,0);
});
