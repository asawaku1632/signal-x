/**
 * Research-only shortlist derived exclusively from a verified audit report.
 * Not a recommendation, trading signal, production deployment, or AI update.
 */
export function listAuditedForwardResearchCandidates(report) {
  if (!report || report.mode!=="OFFLINE_RESEARCH_AUDIT" ||
      !Array.isArray(report.findings) || report.reviewChain?.valid!==true ||
      report.status!=="MANUAL_RESEARCH_REVIEW_ONLY" ||
      report.productionReadiness!=="NOT_READY_FOR_PRODUCTION" ||
      report.autoApply!==false || report.productionWrites!==false) {
    return {status:"BLOCKED",candidates:[],productionWrites:false,autoApply:false};
  }
  const candidates=report.findings.filter((f)=>
    f.status==="MANUAL_RESEARCH_REVIEW_ONLY" &&
    f.researchDecision==="IMPROVEMENT_CANDIDATE" &&
    f.latestReviewDecision==="RESEARCH_CANDIDATE" &&
    f.matchingReviewEvidence===true &&
    f.evidenceStatus==="MATCH" &&
    f.reviewHistoryPresent===true &&
    Array.isArray(f.reasons) && f.reasons.length===0
  ).map((f)=>({proposalId:f.proposalId,status:"RESEARCH_REVIEW_CANDIDATE",
    productionApproval:false,autoApply:false}));
  return {status:candidates.length?"RESEARCH_SHORTLIST":"NO_ELIGIBLE_CANDIDATES",
    candidates,productionWrites:false,autoApply:false};
}
