import test from "node:test";
import assert from "node:assert/strict";
import { assessCaptureForReview } from "../../app/lib/learning/assessCaptureForReview.mjs";
const capture={scan_run_id:"r1",code:"590A",capture_status:"QUARANTINED",scan_received_at:"2026-10-28T06:35:00Z",source_bar_at:"2026-10-28T06:30:00Z"};
const evidence={scan_run_id:"r1",code:"590A",independently_verified:true,provider_license_verified:true,feature_lineage_verified:true,source_bar_at:capture.source_bar_at,feature_computed_at:"2026-10-28T06:32:00Z",provider_observed_at:"2026-10-28T06:30:00Z"};
test("eligible only for manual review, never automatically verified",()=>{
 assert.deepEqual(assessCaptureForReview(capture,evidence),{eligible:true,reason:"REVIEW_READY_NOT_VERIFIED"});
 assert.equal(capture.capture_status,"QUARANTINED");
});
for(const [name,cap,ev,reason] of [
 ["no evidence",capture,null,"MISSING_INDEPENDENT_EVIDENCE"],
 ["no license",capture,{...evidence,provider_license_verified:false},"MISSING_INDEPENDENT_EVIDENCE"],
 ["no lineage",capture,{...evidence,feature_lineage_verified:false},"MISSING_INDEPENDENT_EVIDENCE"],
 ["wrong code",capture,{...evidence,code:"9984"},"EVIDENCE_IDENTITY_MISMATCH"],
 ["late feature",capture,{...evidence,feature_computed_at:"2026-10-28T07:00:00Z"},"POST_PREDICTION_INFORMATION"],
 ["late provider",capture,{...evidence,provider_observed_at:"2026-10-28T07:00:00Z"},"POST_PREDICTION_INFORMATION"],
 ["wrong bar",capture,{...evidence,source_bar_at:"2026-10-28T06:29:00Z"},"SOURCE_BAR_MISMATCH"],
 ["missing time",capture,{...evidence,feature_computed_at:null},"INVALID_EVIDENCE_TIME"],
 ["incorrect state",{...capture,capture_status:"ASOF_CANDIDATE"},evidence,"INVALID_CAPTURE_STATE"]
]) test(name,()=>assert.equal(assessCaptureForReview(cap,ev).reason,reason));
