/**
 * Offline, deterministic proposal records for independently reviewed
 * forward-outcome evidence. No database writes or production AI updates.
 */
export function buildForwardResearchProposals(decisions, {
  researchVersion = "daily-forward-v1",
  sourceReview = "NOT_VERIFIED",
  licenseReview = "NOT_VERIFIED",
} = {}) {
  if (!Array.isArray(decisions)) throw new TypeError("decisions must be an array");
  if (typeof researchVersion !== "string" || !researchVersion.trim()) throw new Error("researchVersion required");
  return decisions.map((d)=>{
    const decision=["IMPROVEMENT_CANDIDATE","HOLD","NOT_ADOPTED"].includes(d?.decision)?d.decision:"HOLD";
    const checks=[
      {key:"DATA_PROVENANCE",status:sourceReview==="VERIFIED"?"PASS":"PENDING"},
      {key:"LICENSE",status:licenseReview==="VERIFIED"?"PASS":"PENDING"},
      {key:"INDEPENDENT_HOLDOUT",status:decision==="IMPROVEMENT_CANDIDATE"?"REVIEW_REQUIRED":"PENDING"},
      {key:"NO_LOOKAHEAD_OR_OVERLAP",status:"REVIEW_REQUIRED"},
      {key:"TRANSACTION_COSTS_AND_SLIPPAGE",status:"REVIEW_REQUIRED"},
      {key:"RISK_AND_DRAWDOWN",status:"REVIEW_REQUIRED"},
      {key:"HUMAN_APPROVAL",status:"REVIEW_REQUIRED"},
    ];
    return {
      schemaVersion:1, researchVersion,
      proposalId:`FORWARD-${String(d?.horizon??"NA")}-${String(d?.band??"NA").replace(/[^a-zA-Z0-9-]/g,"")}`,
      horizon:d?.horizon??null,scoreBand:d?.band??null,
      researchDecision:decision,
      objective:"Review whether a verified score-band forward outcome merits a future SIGNALX AI scoring experiment.",
      evidenceReason:typeof d?.reason==="string"?d.reason:"MISSING_REASON",
      proposedChange:"No parameter change specified. Design a separate controlled experiment before proposing model or scoring changes.",
      checks,
      readiness:"NOT_READY_FOR_PRODUCTION",
      approval:"NOT_REQUESTED",
      autoApply:false,
      productionWrites:false,
      note:"Research proposal only; no proof of predictive improvement or trade profitability.",
    };
  });
}
