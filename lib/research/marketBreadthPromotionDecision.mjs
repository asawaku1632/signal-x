// Human-reviewed, research-only decision record. Never performs deployment or notification.
export function buildMarketBreadthPromotionDecision(readiness,{reviewerApproval=false,licenseApproval=false,independentAuditApproval=false}={}){
 if(!readiness||readiness.schemaVersion!=='market-breadth-evidence-readiness-v1'||
  readiness.researchOnly!==true||readiness.productionEligible!==false||
  typeof reviewerApproval!=='boolean'||typeof licenseApproval!=='boolean'||
  typeof independentAuditApproval!=='boolean')throw new TypeError('INVALID_PROMOTION_DECISION_INPUT');
 const blockers=[];
 if(!readiness.coveragePresent)blockers.push('REQUIRED_EVIDENCE_COVERAGE_MISSING');
 if(!readiness.researchCohortEligible)blockers.push('ROW_LEVEL_RESEARCH_VERIFICATION_MISSING');
 if(!reviewerApproval)blockers.push('HUMAN_REVIEW_PENDING');
 if(!licenseApproval)blockers.push('LICENSE_REVIEW_PENDING');
 if(!independentAuditApproval)blockers.push('INDEPENDENT_AUDIT_PENDING');
 return {schemaVersion:'market-breadth-promotion-decision-v1',researchOnly:true,
  productionEligible:false,notificationEligible:false,automatedPromotionEligible:false,
  status:'BLOCKED',blockers,
  nextAction:'Complete independent row-level research and approvals; any production rollout requires a separate explicit change request.'};
}
