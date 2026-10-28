import test from "node:test";
import assert from "node:assert/strict";
import { classifyResearchEvidence } from "../../app/lib/learning/classifyResearchEvidence.mjs";
test("empty evidence cannot be interpreted as approved learning",()=>{
 const x=classifyResearchEvidence([]);
 assert.equal(x.independently_approved_count,0);
 assert.equal(x.eligible_for_live_ai,false);
});
test("incomplete source permissions and outcomes are named",()=>{
 const x=classifyResearchEvidence([{provider:"YAHOO_CHART",independent_feature_asof_verified:false}]);
 assert.equal(x.entries[0].status,"EVIDENCE_REVIEW_REQUIRED");
 assert.equal(x.missing_evidence_reasons.PROVIDER_PERMISSION_UNDOCUMENTED,1);
 assert.equal(x.missing_evidence_reasons.FEATURE_ASOF_UNVERIFIED,1);
 assert.equal(x.missing_evidence_reasons.FORWARD_OUTCOME_UNVERIFIED,1);
});
test("even fully documented claims require independent human review",()=>{
 const x=classifyResearchEvidence([{provider_permission_reviewed:true,permission_reference:"review-1",independent_feature_asof_verified:true,feature_lineage_reference:"lineage-1",five_jpx_sessions_completed:true,independent_outcome_verified:true,outcome_reference:"outcome-1"}]);
 assert.equal(x.entries[0].status,"DOCUMENTED_CLAIMS_REQUIRE_HUMAN_REVIEW");
 assert.equal(x.independently_approved_count,0);
 assert.equal(x.eligible_for_live_ai,false);
});
test("malformed source records cannot pass",()=>{
 const x=classifyResearchEvidence([null,42]);
 assert.equal(x.missing_evidence_reasons.INVALID_RECORD,2);
 assert.throws(()=>classifyResearchEvidence(null),/INVALID_EVIDENCE_RECORDS/);
});
