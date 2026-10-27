import test from "node:test";
import assert from "node:assert/strict";
import { prepareForwardResearchSnapshotExport } from "../app/lib/research/dailyForwardSnapshotExportAdapter.mjs";
const legacy={stock_code:"7203",session_date:"2026-10-20",horizon:5,
 status:"VERIFIED",returnPct:3,provider:"Yahoo",sourceRecordId:"legacy-1",modelVersion:"old"};
test("legacy snapshot does not inherit unproven verification",()=>{
 const result=prepareForwardResearchSnapshotExport([legacy]);
 assert.equal(result.status,"NOT_READY");
 assert.equal(result.rows[0].priceBasisVerified,false);
 assert.equal(result.rows[0].returnPct,null);
 assert.ok(result.diagnostic.reasonCounts.FORWARD_OUTCOME_NOT_VERIFIED);
});
test("explicit reviewed metadata reaches only manual research readiness",()=>{
 const result=prepareForwardResearchSnapshotExport([{
 ...legacy,priceBasisVerified:true,priceEvidenceReviewed:true,
 licenseReview:"VERIFIED",licenseEvidenceReviewed:true,
 }]);
 assert.equal(result.status,"METADATA_READY_FOR_INDEPENDENT_REVIEW");
 assert.equal(result.autoApply,false);
 assert.equal(result.productionWrites,false);
});
test("license and price reviews require both claims",()=>{
 const result=prepareForwardResearchSnapshotExport([{
 ...legacy,priceBasisVerified:true,licenseReview:"VERIFIED",
 }]);
 assert.equal(result.status,"NOT_READY");
});
test("invalid export fails closed",()=>{
 assert.equal(prepareForwardResearchSnapshotExport(null).status,"BLOCKED");
});
