import test from "node:test";
import assert from "node:assert/strict";
import { buildScanEvidenceReview } from "../../app/lib/learning/buildScanEvidenceReview.mjs";
const capture = { scan_run_id:"r1",code:"590A",capture_status:"QUARANTINED",scan_received_at:"2026-10-28T06:35:00Z",source_bar_at:"2026-10-28T06:30:00Z" };
const evidence = { scan_run_id:"r1",code:"590A",source_bar_at:capture.source_bar_at,independently_verified:true,provider_license_verified:true,feature_lineage_verified:true,feature_computed_at:"2026-10-28T06:31:00Z",provider_observed_at:"2026-10-28T06:30:00Z" };
test("review-ready capture is never auto verified or mutated",()=>{
 const before=structuredClone(capture);
 const [row]=buildScanEvidenceReview([capture],[evidence]);
 assert.equal(row.review_ready,true);
 assert.equal(row.asof_verified,false);
 assert.equal(row.reason,"REVIEW_READY_NOT_VERIFIED");
 assert.deepEqual(capture,before);
});
test("no evidence is not review-ready",()=>{
 const [row]=buildScanEvidenceReview([capture],[]);
 assert.equal(row.review_ready,false);
});
test("duplicate evidence fails closed",()=>{
 const [row]=buildScanEvidenceReview([capture],[evidence,evidence]);
 assert.equal(row.reason,"AMBIGUOUS_EVIDENCE");
});
test("mismatched evidence cannot certify a different stock",()=>{
 const [row]=buildScanEvidenceReview([capture],[{...evidence,code:"9984"}]);
 assert.equal(row.review_ready,false);
});
test("future computed feature fails",()=>{
 const [row]=buildScanEvidenceReview([capture],[{...evidence,feature_computed_at:"2026-10-29T06:31:00Z"}]);
 assert.equal(row.reason,"POST_PREDICTION_INFORMATION");
});
test("bad input fails closed",()=>{
 assert.throws(()=>buildScanEvidenceReview({},[]),/INVALID_RESEARCH_INPUT/);
});
