import test from "node:test";
import assert from "node:assert/strict";
import { captureAndIngestResearchDevScan as execute } from "../../app/lib/learning/captureAndIngestResearchDevScan.mjs";
test("dev capture and ingestion is disabled without both explicit gates",async()=>{
 let scans=0,queries=0;
 const scan=async()=>{scans++;return {};};
 const client={query:async()=>{queries++;}};
 await assert.rejects(execute(scan,client,{limit:1}),/RESEARCH_DEV_CAPTURE_AND_WRITE_DISABLED/);
 assert.equal(scans,0);assert.equal(queries,0);
});
test("malformed Scan execution never reaches SQL even with both flags",async()=>{
 const saved={node:process.env.NODE_ENV,capture:process.env.SIGNALX_RESEARCH_CAPTURE,write:process.env.SIGNALX_RESEARCH_DEV_WRITE};
 process.env.NODE_ENV="development";
 process.env.SIGNALX_RESEARCH_CAPTURE="true";
 process.env.SIGNALX_RESEARCH_DEV_WRITE="true";
 let queries=0;
 try{
  const result=await execute(async()=>({stocks:[],diagnostics:{targetStockCount:1,analyzedSuccessCount:0,analyzedFailureCount:1}}),
   {query:async()=>{queries++;return {rowCount:1};}},{limit:1});
  assert.equal(result.accepted,false);assert.equal(result.inserted,0);assert.equal(queries,0);
 }finally{
  for(const [k,v] of [["NODE_ENV",saved.node],["SIGNALX_RESEARCH_CAPTURE",saved.capture],["SIGNALX_RESEARCH_DEV_WRITE",saved.write]])
   if(v===undefined)delete process.env[k];else process.env[k]=v;
 }
});
