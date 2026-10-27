import test from "node:test";
import assert from "node:assert/strict";
import { inspectForwardResearchExport } from "../app/lib/research/dailyForwardResearchExportReadiness.mjs";
const row={code:"7203",date:"2026-10-20",horizon:5,status:"VERIFIED",
 priceBasisVerified:true,returnPct:2,licenseReview:"VERIFIED",
 provider:"test-fixture",sourceRecordId:"record-1",modelVersion:"frozen-1"};
test("complete synthetic metadata can only reach independent review",()=>{
 const result=inspectForwardResearchExport([row],{source:"synthetic"});
 assert.equal(result.status,"METADATA_READY_FOR_INDEPENDENT_REVIEW");
 assert.equal(result.productionApproval,false);
 assert.equal(result.autoApply,false);
});
test("legacy Yahoo-derived unverified price cannot be promoted",()=>{
 const result=inspectForwardResearchExport([{...row,priceBasisVerified:false,licenseReview:"NOT_VERIFIED"}]);
 assert.equal(result.status,"NOT_READY");
 assert.ok(result.reasonCounts.FORWARD_OUTCOME_NOT_VERIFIED);
 assert.ok(result.reasonCounts.LICENSE_REVIEW_REQUIRED);
});
test("duplicate rows and missing model version are blocked",()=>{
 const result=inspectForwardResearchExport([row,{...row,modelVersion:""}]);
 assert.equal(result.status,"NOT_READY");
 assert.ok(result.reasonCounts.DUPLICATE_OBSERVATION);
 assert.ok(result.reasonCounts.MODEL_VERSION_MISSING);
});
test("missing input fails closed",()=>{
 assert.equal(inspectForwardResearchExport().status,"BLOCKED");
 assert.equal(inspectForwardResearchExport([]).status,"NOT_READY");
});
