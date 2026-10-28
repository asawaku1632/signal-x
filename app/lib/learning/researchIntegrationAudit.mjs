import {assessObservationCoverage} from "./researchObservationCoverage.mjs";
import {inspectStoredGapMatrix} from "./researchObservedGapMatrix.mjs";
import {reconcileReadOnlyEvidence} from "./researchRealEvidenceReconciliation.mjs";
// Pure read-only composition. No approval or runtime production wiring.
export function auditResearchIntegration(aggregate, observations, evidence, options={}) {
 const coverage=assessObservationCoverage(aggregate);
 const gaps=inspectStoredGapMatrix(observations,options);
 const reconciliation=reconcileReadOnlyEvidence(observations,evidence,options);
 const blockers=new Set([...coverage.issues,...Object.keys(gaps.reasonCounts||{}),...Object.keys(reconciliation.reasonCounts||{})]);
 if(coverage.total!==undefined&&Array.isArray(observations)&&observations.length>coverage.total)blockers.add("SAMPLE_EXCEEDS_REPORTED_TOTAL");
 if(coverage.total!==undefined&&Array.isArray(observations)&&observations.length<coverage.total)blockers.add("PARTIAL_OBSERVATION_SAMPLE");
 if(gaps.truncated||reconciliation.truncated)blockers.add("TRUNCATED_EVIDENCE");
 blockers.add("INDEPENDENT_PROVENANCE_REVIEW_REQUIRED");
 return {status:"BLOCKED",adoptable:false,productionMutationAllowed:false,notificationAllowed:false,checks:{coverage:coverage.status,gaps:gaps.status,reconciliation:reconciliation.status},reviewed:reconciliation.checked,blockers:[...blockers].sort(),coverage:{total:coverage.total??null,completedFiveDay:coverage.completedFiveDay??null,pendingFiveDay:coverage.pendingFiveDay??null},matchedClaims:reconciliation.matched??0};
}
