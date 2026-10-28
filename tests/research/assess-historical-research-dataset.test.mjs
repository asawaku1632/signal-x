import test from "node:test";
import assert from "node:assert/strict";
import { assessHistoricalResearchDataset as audit } from "../../app/lib/learning/assessHistoricalResearchDataset.mjs";
test("delayed retrospective rows cannot masquerade as original signals",()=>{
 const x=audit([{observation_date:"2026-10-14",created_at:"2026-10-14T12:38:12Z",provider:"YAHOO_CHART"}]);
 assert.equal(x.reviewed,1);
 assert.equal(x.items[0].classification,"RETROSPECTIVE_REFERENCE_ONLY");
 assert.equal(x.issues.UNVERIFIED_RESEARCH_LICENSE,1);
 assert.equal(x.issues.NO_VERIFIED_ASOF_PREDICTION,1);
 assert.equal(x.eligible_for_ai_power_training,false);
});
test("even documented historical sources never auto-promote to verified predictions",()=>{
 const x=audit([{observation_date:"2026-10-14",created_at:"2026-10-14T06:30:00Z",provider:"licensed-source",
 license_review_verified:true,license_evidence_reference:"evidence-ref",independent_prediction_timestamp_verified:true}]);
 assert.equal(x.verified_forward_predictions,0);
 assert.equal(x.items[0].classification,"RETROSPECTIVE_REFERENCE_ONLY");
});
test("invalid historical rows fail closed",()=>{
 assert.equal(audit([null]).issues.INVALID_ROW,1);
 assert.throws(()=>audit(null),/INVALID_HISTORICAL_DATASET/);
});
