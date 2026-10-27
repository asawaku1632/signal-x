/**
 * Create controlled offline experiment plans from an audited research shortlist.
 * Plans are hypotheses, not model improvements or production approvals.
 */
export function planForwardResearchExperiments(shortlist, {
  baselineVersion, proposedVersion, holdoutStart, holdoutEnd,
  minVerifiedSamples=100, maxDrawdownPct=10,
} = {}) {
  if (!shortlist || shortlist.status!=="RESEARCH_SHORTLIST" ||
      !Array.isArray(shortlist.candidates) || shortlist.autoApply!==false ||
      shortlist.productionWrites!==false) {
    return {status:"BLOCKED",plans:[],reasons:["SHORTLIST_NOT_AUDIT_CLEARED"],autoApply:false};
  }
  const required={baselineVersion,proposedVersion,holdoutStart,holdoutEnd};
  const missing=Object.entries(required).filter(([,v])=>typeof v!=="string"||!v.trim()).map(([k])=>k);
  if (baselineVersion===proposedVersion) missing.push("DISTINCT_MODEL_VERSIONS");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(holdoutStart??"") ||
      !/^\d{4}-\d{2}-\d{2}$/.test(holdoutEnd??"") ||
      holdoutStart>=holdoutEnd) missing.push("VALID_HOLDOUT_WINDOW");
  if (!Number.isInteger(minVerifiedSamples)||minVerifiedSamples<30) missing.push("MIN_VERIFIED_SAMPLES");
  if (typeof maxDrawdownPct!=="number"||!Number.isFinite(maxDrawdownPct)||maxDrawdownPct<=0) missing.push("MAX_DRAWDOWN");
  if (missing.length) return {status:"BLOCKED",plans:[],reasons:missing,autoApply:false};
  const plans=shortlist.candidates.filter(c=>c?.status==="RESEARCH_REVIEW_CANDIDATE" &&
      typeof c.proposalId==="string" && c.proposalId.length>0 &&
      c.productionApproval===false && c.autoApply===false).map(c=>({
    schemaVersion:1,proposalId:c.proposalId,
    hypothesis:"Test whether a pre-registered scoring change improves out-of-sample forward outcomes over the frozen baseline.",
    baselineVersion,proposedVersion,holdoutStart,holdoutEnd,
    primaryMetric:"5/10/20-trading-day verified forward return, preselected by proposal horizon",
    secondaryMetrics:["positiveRate","averageReturnPct","maxDrawdownPct","turnover","transactionCostAdjustedReturn"],
    minimumVerifiedSamples:minVerifiedSamples,maxDrawdownPct,
    controls:["Freeze model versions before holdout","No lookahead","No train/holdout overlap",
      "Report all missing and excluded observations","Account for costs and slippage",
      "Require independent licensed price-source review","Require human review"],
    status:"DESIGN_ONLY_NOT_EXECUTED",autoApply:false,productionWrites:false,
    productionApproval:false,
  }));
  return {status:plans.length?"EXPERIMENT_DESIGNS_ONLY":"NO_ELIGIBLE_PLANS",
    plans,reasons:[],autoApply:false,productionWrites:false};
}
