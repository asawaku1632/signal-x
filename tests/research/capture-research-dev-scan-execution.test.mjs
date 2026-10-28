import test from "node:test";
import assert from "node:assert/strict";
import { captureResearchDevScanExecution as capture } from "../../app/lib/learning/captureResearchDevScanExecution.mjs";
const oldNode=process.env.NODE_ENV, oldFlag=process.env.SIGNALX_RESEARCH_CAPTURE;
function restore(){if(oldNode===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=oldNode;if(oldFlag===undefined)delete process.env.SIGNALX_RESEARCH_CAPTURE;else process.env.SIGNALX_RESEARCH_CAPTURE=oldFlag;}
test("development research capture is off by default without invoking scan",async()=>{
 let calls=0;delete process.env.SIGNALX_RESEARCH_CAPTURE;
 try{await assert.rejects(capture(async()=>{calls++;return {};},{limit:1}),/RESEARCH_CAPTURE_DISABLED/);assert.equal(calls,0)}
 finally{restore()}
});
test("captures actual execution times but never verifies or writes",async()=>{
 process.env.NODE_ENV="development";process.env.SIGNALX_RESEARCH_CAPTURE="true";
 let calls=0;const dates=["2026-10-28T06:29:00.000Z","2026-10-28T06:35:00.000Z"];
 try{
 const x=await capture(async(limit)=>{calls++;assert.equal(limit,1);return {stocks:[{code:"590A",price:1000,aiPower:75,dataSource:"intraday",latestBarTimestamp:Date.parse("2026-10-28T06:30:00Z")/1000}],diagnostics:{targetStockCount:1,analyzedSuccessCount:1,analyzedFailureCount:0}}},{limit:1,now:()=>new Date(dates.shift()),id:()=>"record-1"});
 assert.equal(x.accepted,true);assert.equal(x.artifact.scanRunId,"record-1");assert.equal(x.artifact.scanStartedAt,"2026-10-28T06:29:00.000Z");assert.equal(x.artifact.scanCompletedAt,"2026-10-28T06:35:00.000Z");assert.equal(calls,1);
 }finally{restore()}
});
test("partial scan is rejected",async()=>{
 process.env.NODE_ENV="development";process.env.SIGNALX_RESEARCH_CAPTURE="true";
 try{const x=await capture(async()=>({stocks:[],diagnostics:{targetStockCount:1,analyzedSuccessCount:0,analyzedFailureCount:1}}),{limit:1});
 assert.equal(x.accepted,false);assert.equal(x.artifact,null)}finally{restore()}
});
