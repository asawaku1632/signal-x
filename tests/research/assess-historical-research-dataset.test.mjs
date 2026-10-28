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

test("Japanese midnight boundary marks prior-day storage as delayed",()=>{
 const x=audit([{observation_date:"2026-10-14",created_at:"2026-10-14T15:00:00Z",provider:"source"}]);
 assert.equal(x.issues.SAVED_AFTER_OBSERVATION_DAY,1);
});
test("invalid dates and timezone-free timestamps never pass audit",()=>{
 const x=audit([{observation_date:"2026-02-30",created_at:"2026-02-28T12:00:00",provider:"source"}]);
 assert.equal(x.issues.INVALID_OBSERVATION_DATE,1);
 assert.equal(x.issues.MISSING_OBSERVATION_OR_STORAGE_TIME,1);
});

test("actual PostgreSQL timestamptz text is classified by Japan day",()=>{
 const rows=[
  {observation_date:"2026-10-14",created_at:"2026-10-14 12:38:12.89497+00",provider:"YAHOO_CHART"},
  {observation_date:"2026-08-21",created_at:"2026-08-22 13:45:53.458056+00",provider:"YAHOO_CHART"}
 ];
 const result=audit(rows);
 assert.equal(result.reviewed,2);
 assert.equal(result.issues.MISSING_OBSERVATION_OR_STORAGE_TIME??0,0);
 assert.equal(result.issues.SAVED_AFTER_OBSERVATION_DAY,1);
 assert.equal(result.verified_forward_predictions,0);
});

test("storage before Japanese observation day is flagged, not counted as real prediction",()=>{
 const result=audit([{observation_date:"2026-10-14",created_at:"2026-10-13T14:59:59Z",provider:"source"}]);
 assert.equal(result.issues.SAVED_BEFORE_OBSERVATION_DAY,1);
 assert.equal(result.verified_forward_predictions,0);
});
test("storage within Japanese observation day is not mislabeled as delayed",()=>{
 const result=audit([{observation_date:"2026-10-14",created_at:"2026-10-13T15:00:00Z",provider:"source"}]);
 assert.equal(result.issues.SAVED_BEFORE_OBSERVATION_DAY??0,0);
 assert.equal(result.issues.SAVED_AFTER_OBSERVATION_DAY??0,0);
 assert.equal(result.eligible_for_ai_power_training,false);
});
