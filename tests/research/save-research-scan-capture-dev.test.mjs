import test from "node:test";
import assert from "node:assert/strict";
import { saveResearchScanCaptureDev } from "../../app/lib/learning/saveResearchScanCaptureDev.mjs";

const received="2026-10-27T06:35:00Z";
const stock={code:"9984",price:5000,aiPower:78,latestBarTimestamp:Date.parse("2026-10-27T06:30:00Z")/1000};
const input={scanRunId:"test-run",tradeDate:"2026-10-27",scanReceivedAt:received,scanResponse:{stocks:[stock]}};
async function enabled(fn) {
 const old=process.env.SIGNALX_RESEARCH_DEV_WRITE;
 const nodeEnv=process.env.NODE_ENV;
 process.env.SIGNALX_RESEARCH_DEV_WRITE="true";
 process.env.NODE_ENV="test";
 try { await fn(); } finally {
  if(old===undefined) delete process.env.SIGNALX_RESEARCH_DEV_WRITE;
  else process.env.SIGNALX_RESEARCH_DEV_WRITE=old;
  if(nodeEnv===undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV=nodeEnv;
 }
}
test("disabled by default",async()=>{
 const old=process.env.SIGNALX_RESEARCH_DEV_WRITE;
 delete process.env.SIGNALX_RESEARCH_DEV_WRITE;
 try { await assert.rejects(saveResearchScanCaptureDev({query:async()=>({rowCount:1})},input),/RESEARCH_DEV_WRITE_DISABLED/); }
 finally {if(old!==undefined) process.env.SIGNALX_RESEARCH_DEV_WRITE=old;}
});
test("inserts once and skips conflict",async()=>enabled(async()=>{
 let calls=0;
 const client={connectionParameters:{host:"db.jdtqwryiyxeuoraecorw.supabase.co"},query:async(sql,values)=>{assert.match(sql,/ON CONFLICT.*DO NOTHING/s);assert.equal(values[2],"9984");return {rowCount:++calls===1?1:0};}};
 const first=await saveResearchScanCaptureDev(client,input);
 const second=await saveResearchScanCaptureDev(client,input);
 assert.equal(first.inserted,1);assert.equal(second.duplicates,1);
}));
test("quarantined record stays marked",async()=>enabled(async()=>{
 const client={connectionParameters:{host:"db.jdtqwryiyxeuoraecorw.supabase.co"},query:async(_sql,values)=>{assert.equal(values[15],"QUARANTINED");assert.equal(values[16],"MISSING_OR_INVALID_TIMESTAMP");return {rowCount:1};}};
 const result=await saveResearchScanCaptureDev(client,{...input,scanResponse:{stocks:[{...stock,latestBarTimestamp:null}]}});
 assert.equal(result.quarantined,1);
}));
test("invalid code never reaches database",async()=>enabled(async()=>{
 const client={connectionParameters:{host:"db.jdtqwryiyxeuoraecorw.supabase.co"},query:async()=>{throw new Error("unexpected DB call");}};
 const result=await saveResearchScanCaptureDev(client,{...input,scanResponse:{stocks:[{...stock,code:"BAD"}]}});
 assert.equal(result.quarantined,1);assert.equal(result.inserted,0);
}));

test("refuses unknown or production database before any SQL",async()=>enabled(async()=>{
 let calls=0;
 const client={connectionParameters:{host:"db.paygtakajhvatwejygda.supabase.co"},query:async()=>{calls++;}};
 await assert.rejects(saveResearchScanCaptureDev(client,input),/RESEARCH_DEV_DATABASE_NOT_VERIFIED/);
 assert.equal(calls,0);
}));
test("refuses a database client without verifiable connection host",async()=>enabled(async()=>{
 const client={query:async()=>{throw new Error("must not query");}};
 await assert.rejects(saveResearchScanCaptureDev(client,input),/RESEARCH_DEV_DATABASE_NOT_VERIFIED/);
}));

test("alphanumeric stock code can reach quarantine-only insert",async()=>enabled(async()=>{
 let calls=0;
 const client={connectionParameters:{host:"db.jdtqwryiyxeuoraecorw.supabase.co"},query:async(_sql,values)=>{
  calls++;assert.equal(values[2],"590A");assert.equal(values[15],"QUARANTINED");return {rowCount:1};
 }};
 const result=await saveResearchScanCaptureDev(client,{...input,scanResponse:{cached:false,stocks:[{...stock,code:"590A"}]}});
 assert.equal(calls,1);assert.equal(result.inserted,1);
}));

test("invalid research run date is rejected without writes",async()=>enabled(async()=>{
 let queries=0;
 const client={connectionParameters:{host:"db.jdtqwryiyxeuoraecorw.supabase.co"},query:async()=>{queries++;return {rowCount:1};}};
 await assert.rejects(saveResearchScanCaptureDev(client,{...input,tradeDate:"2026-02-30"}),/INVALID_RESEARCH_RUN_METADATA/);
 assert.equal(queries,0);
}));
test("missing Scan received time is rejected without writes",async()=>enabled(async()=>{
 let queries=0;
 const client={connectionParameters:{host:"db.jdtqwryiyxeuoraecorw.supabase.co"},query:async()=>{queries++;return {rowCount:1};}};
 await assert.rejects(saveResearchScanCaptureDev(client,{...input,scanReceivedAt:null}),/INVALID_RESEARCH_RUN_METADATA/);
 assert.equal(queries,0);
}));

test("repeated code within a Scan is skipped before SQL",async()=>enabled(async()=>{
 let calls=0;
 const client={connectionParameters:{host:"db.jdtqwryiyxeuoraecorw.supabase.co"},query:async()=>{
   calls++;return {rowCount:1};
 }};
 const result=await saveResearchScanCaptureDev(client,{...input,scanResponse:{cached:false,stocks:[stock,stock]}});
 assert.equal(calls,1);
 assert.equal(result.inserted,1);
 assert.equal(result.duplicates,1);
 assert.equal(result.quarantined,2);
}));
