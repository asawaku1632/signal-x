import test from "node:test";
import assert from "node:assert/strict";
import { ingestGeneratedScanIntoResearchDev as ingest } from "../../app/lib/learning/ingestGeneratedScanIntoResearchDev.mjs";
const input={scanRunId:"dev-intake",tradeDate:"2026-10-28",scanStartedAt:"2026-10-28T06:29:00Z",
scanCompletedAt:"2026-10-28T06:35:00Z",
payload:{cached:false,updatedAt:"2026-10-28T06:34:00Z",stocks:[
{code:"590A",price:1200,aiPower:75,latestBarTimestamp:Date.parse("2026-10-28T06:30:00Z")/1000}
]}};
test("dev writer defaults off and never sends SQL",async()=>{
 const old=process.env.SIGNALX_RESEARCH_DEV_WRITE;
 delete process.env.SIGNALX_RESEARCH_DEV_WRITE;
 try {
  let calls=0;
  const client={connectionParameters:{host:"db.jdtqwryiyxeuoraecorw.supabase.co"},query:async()=>{calls++;return {rowCount:1};}};
  await assert.rejects(ingest(client,input),/RESEARCH_DEV_WRITE_DISABLED/);
  assert.equal(calls,0);
 } finally {if(old!==undefined)process.env.SIGNALX_RESEARCH_DEV_WRITE=old;}
});
test("cached Scan fails before any database call",async()=>{
 const result=await ingest({query:async()=>{throw Error("should not query");}},{
  ...input,payload:{...input.payload,cached:true}
 });
 assert.equal(result.accepted,false);
 assert.equal(result.inserted,0);
 assert.equal(result.persisted,false);
 assert.equal(result.promoted,false);
});
test("invalid generated trade date fails before database call",async()=>{
 const result=await ingest({query:async()=>{throw Error("should not query");}},{...input,tradeDate:"2026-10-27"});
 assert.equal(result.accepted,false);
 assert.equal(result.reason,"TRADE_DATE_MISMATCH");
});

test("partially invalid Scan is rejected as a whole before any SQL",async()=>{
 let calls=0;
 const client={query:async()=>{calls++;return {rowCount:1};}};
 const result=await ingest(client,{...input,payload:{...input.payload,stocks:[
 input.payload.stocks[0],
 {...input.payload.stocks[0],code:"641A",latestBarTimestamp:null}
 ]}});
 assert.equal(result.accepted,false);
 assert.equal(result.reason,"INCOMPLETE_OR_UNSAFE_RESEARCH_RUN");
 assert.equal(result.blocked,1);
 assert.equal(result.inserted,0);
 assert.equal(calls,0);
});
test("duplicate stock in generated Scan fails before writing",async()=>{
 let calls=0;
 const result=await ingest({query:async()=>{calls++;return {rowCount:1};}},
 {...input,payload:{...input.payload,stocks:[input.payload.stocks[0],input.payload.stocks[0]]}});
 assert.equal(result.accepted,false);
 assert.equal(result.blocked_reasons.DUPLICATE_CODE,1);
 assert.equal(calls,0);
});
