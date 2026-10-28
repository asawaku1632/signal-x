import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root=path.resolve(import.meta.dirname,"..");
const names=[
"researchObservationProvenanceGate.mjs",
"researchIndependentPairAudit.mjs",
"researchReplicationEvidence.mjs",
"researchEvidenceBlockerReport.mjs",
"researchRemediationPlan.mjs",
"researchActualStoredReadiness.mjs",
"researchObservedGapMatrix.mjs",
"researchRealEvidenceReconciliation.mjs",
"researchObservationCoverage.mjs",
"researchIntegrationAudit.mjs",
"researchSnapshotBoundary.mjs",
"researchSnapshotConsistency.mjs"
];
for(const name of names){
 test(name+" exists and remains a pure research module",()=>{
   const source=fs.readFileSync(path.join(root,"app/lib/learning",name),"utf8");
   assert.ok(source.length>100);
   for(const forbidden of [/\bfetch\s*\(/,/\bexecute_sql\b/,/\bINSERT\s+INTO\b/i,/\bUPDATE\s+public\./i,/\bDELETE\s+FROM\b/i,/\bLINE_CHANNEL_ACCESS_TOKEN\b/,/\bprocess\.env\b/]){
    assert.doesNotMatch(source,forbidden);
   }
 });
}
test("stage report forbids premature merge",()=>{
 const text=fs.readFileSync(path.join(root,"docs/research/stage1296-1325-stack-audit-20261028.md"),"utf8");
 assert.match(text,/DO NOT MERGE/);
 assert.match(text,/PR #216/);
 assert.match(text,/independent/);
});
