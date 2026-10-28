import test from "node:test";
import assert from "node:assert/strict";
import { createGeneratedScanResearchArtifact as create } from "../../app/lib/learning/createGeneratedScanResearchArtifact.mjs";
import { planScanResearchIntake } from "../../app/lib/learning/planScanResearchIntake.mjs";
const stock={code:"590A",price:1200,aiPower:75,latestBarTimestamp:Date.parse("2026-10-28T06:30:00Z")/1000,dataSource:"intraday"};
const scanResult={stocks:[stock],diagnostics:{targetStockCount:1,analyzedSuccessCount:1,analyzedFailureCount:0}};
const opts={scanResult,scanRunId:"dev-generated-1",scanStartedAt:"2026-10-28T06:29:00Z",scanCompletedAt:"2026-10-28T06:35:00Z"};
test("complete generated Scan becomes offline research artifact without verification",()=>{
 const source=structuredClone(scanResult);
 const result=create(opts);
 assert.equal(result.accepted,true);
 assert.equal(result.artifact.tradeDate,"2026-10-28");
 assert.equal(result.artifact.payload.cached,false);
 const plan=planScanResearchIntake(result.artifact);
 assert.equal(plan.candidate_count,1);
 assert.equal(plan.rows[0].capture_status,"QUARANTINED");
 assert.deepEqual(scanResult,source);
});
test("partial Scan failures cannot masquerade as complete capture",()=>{
 const result=create({...opts,scanResult:{...scanResult,diagnostics:{...scanResult.diagnostics,analyzedFailureCount:1,targetStockCount:2}}});
 assert.equal(result.accepted,false);
 assert.equal(result.reason,"INCOMPLETE_SCAN_EXECUTION");
 assert.equal(result.artifact,null);
});
test("missing scan diagnostics cannot be accepted",()=>{
 const result=create({...opts,scanResult:{stocks:[stock]}});
 assert.equal(result.accepted,false);
 assert.equal(result.reason,"INCOMPLETE_SCAN_EXECUTION");
});
test("Tokyo day crossing is represented by actual completion date",()=>{
 const result=create({...opts,scanStartedAt:"2026-10-27T14:59:00Z",scanCompletedAt:"2026-10-27T15:01:00Z"});
 assert.equal(result.accepted,true);
 assert.equal(result.artifact.tradeDate,"2026-10-28");
});
test("bad timestamp fails without creating artifact",()=>{
 const result=create({...opts,scanCompletedAt:"bad"});
 assert.equal(result.accepted,false);
 assert.equal(result.artifact,null);
});

test("null execution is rejected without throwing",()=>{
 const result=create(null);
 assert.equal(result.accepted,false);
 assert.equal(result.reason,"INVALID_SCAN_EXECUTION");
});
