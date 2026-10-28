import test from "node:test";
import assert from "node:assert/strict";
import { ingestCompletedScanExecutionDev as ingest } from "../../app/lib/learning/ingestCompletedScanExecutionDev.mjs";
const sample={code:"590A",price:1200,aiPower:78,dataSource:"intraday",latestBarTimestamp:Date.parse("2026-10-28T06:30:00Z")/1000};
const input={scanRunId:"run-complete",scanStartedAt:"2026-10-28T06:29:00Z",scanCompletedAt:"2026-10-28T06:35:00Z",scanResult:{
 stocks:[sample],diagnostics:{targetStockCount:1,analyzedSuccessCount:1,analyzedFailureCount:0}
}};
test("incomplete execution never reaches the database",async()=>{
 let calls=0;
 const result=await ingest({query:async()=>{calls++;}},{...input,scanResult:{...input.scanResult,diagnostics:{...input.scanResult.diagnostics,analyzedFailureCount:1}}});
 assert.equal(result.reason,"INCOMPLETE_SCAN_EXECUTION");
 assert.equal(result.inserted,0);
 assert.equal(calls,0);
});
test("valid completed execution still needs explicit dev-write authorization",async()=>{
 const old=process.env.SIGNALX_RESEARCH_DEV_WRITE;
 delete process.env.SIGNALX_RESEARCH_DEV_WRITE;
 let calls=0;
 try{
  await assert.rejects(ingest({query:async()=>{calls++;}},input),/RESEARCH_DEV_WRITE_DISABLED/);
  assert.equal(calls,0);
 } finally {
  if(old!==undefined)process.env.SIGNALX_RESEARCH_DEV_WRITE=old;
 }
});
test("missing bar timestamp is rejected without opening SQL",async()=>{
 let calls=0;
 const result=await ingest({query:async()=>{calls++;}},
 {...input,scanResult:{...input.scanResult,stocks:[{...sample,latestBarTimestamp:null}]}});
 assert.equal(result.reason,"INCOMPLETE_OR_UNSAFE_RESEARCH_RUN");
 assert.equal(result.persisted,false);
 assert.equal(calls,0);
});
