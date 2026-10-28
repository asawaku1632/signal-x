import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exportGeneratedScanResearchArtifactDev as exportArtifact } from "../../app/lib/learning/exportGeneratedScanResearchArtifactDev.mjs";
const stock={code:"590A",price:1200,aiPower:75,latestBarTimestamp:Date.parse("2026-10-28T06:30:00Z")/1000,dataSource:"intraday"};
const input={scanResult:{stocks:[stock],diagnostics:{targetStockCount:1,analyzedSuccessCount:1,analyzedFailureCount:0}},
 scanStartedAt:"2026-10-28T06:29:00Z",scanCompletedAt:"2026-10-28T06:35:00Z",scanRunId:"export-test"};
async function enabled(fn) {
 const oldNode=process.env.NODE_ENV,old=process.env.SIGNALX_RESEARCH_EXPORT_ENABLED;
 process.env.NODE_ENV="development";process.env.SIGNALX_RESEARCH_EXPORT_ENABLED="true";
 try {await fn();}finally{
  if(oldNode===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=oldNode;
  if(old===undefined)delete process.env.SIGNALX_RESEARCH_EXPORT_ENABLED;else process.env.SIGNALX_RESEARCH_EXPORT_ENABLED=old;
 }
}
test("export defaults off, no file write",async()=>{
 await assert.rejects(exportArtifact(input,"/tmp/unwritten-research-artifact.json"),/RESEARCH_EXPORT_DISABLED/);
});
test("complete real-shaped Scan writes one offline quarantined JSON artifact",async()=>enabled(async()=>{
 const dir=await mkdtemp(join(tmpdir(),"signalx-research-"));
 try{
  const path=join(dir,"capture.json");
  const result=await exportArtifact(input,path);
  assert.equal(result.exported,true);
  const stored=JSON.parse(await readFile(path,"utf8"));
  assert.equal(stored.payload.cached,false);
  assert.equal(stored.scanRunId,"export-test");
  assert.equal(stored.tradeDate,"2026-10-28");
  await assert.rejects(exportArtifact(input,path),/EEXIST/);
 }finally{await rm(dir,{recursive:true,force:true});}
}));
test("incomplete Scan never creates a file",async()=>enabled(async()=>{
 const dir=await mkdtemp(join(tmpdir(),"signalx-research-"));
 try{
  const path=join(dir,"capture.json");
  const result=await exportArtifact({...input,scanResult:{...input.scanResult,diagnostics:{targetStockCount:2,analyzedSuccessCount:1,analyzedFailureCount:1}}},path);
  assert.equal(result.exported,false);
  await assert.rejects(readFile(path),/ENOENT/);
 }finally{await rm(dir,{recursive:true,force:true});}
}));
