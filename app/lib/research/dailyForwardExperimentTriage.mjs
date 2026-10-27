/**
 * Research-only triage for three independent offline experiment diagnostics.
 * Never interprets descriptive differences as proof of predictive edge.
 */
export function triageForwardExperimentEvidence({
  comparison,uncertainty,risk,
}={}) {
  const reasons=[];
  if(comparison?.status!=="DESCRIPTIVE_COMPARISON_ONLY") reasons.push("COMPARISON_NOT_CLEARED");
  if(uncertainty?.status!=="DESCRIPTIVE_DIAGNOSTICS_ONLY") reasons.push("UNCERTAINTY_NOT_CLEARED");
  if(risk?.status!=="DESCRIPTIVE_RISK_ONLY") reasons.push("RISK_NOT_CLEARED");
  if(comparison?.improvementProven!==false ||
     uncertainty?.improvementProven!==false ||
     risk?.improvementProven!==false) reasons.push("INVALID_PROOF_CLAIM");
  if(comparison?.autoApply!==false||uncertainty?.autoApply!==false||risk?.autoApply!==false) {
    reasons.push("AUTOMATION_NOT_DISABLED");
  }
  const difference=comparison?.averageDifferencePctPoints;
  if(typeof difference!=="number"||!Number.isFinite(difference)) reasons.push("MISSING_VALID_DIFFERENCE");
  else if(difference<=0) reasons.push("NO_POSITIVE_DESCRIPTIVE_DIFFERENCE");
  const distinctDates=uncertainty?.distinctDates;
  if(!Number.isInteger(distinctDates)||distinctDates<20) reasons.push("INSUFFICIENT_INDEPENDENT_DATES");
  const drawdown=risk?.maxDrawdownPct;
  if(typeof drawdown!=="number"||!Number.isFinite(drawdown)||drawdown<0) reasons.push("MISSING_VALID_DRAWDOWN");
  return {
    status:reasons.length?"HOLD_FOR_MORE_RESEARCH":"ELIGIBLE_FOR_INDEPENDENT_RESEARCH_REVIEW",
    reasons,comparisonDifferencePctPoints:Number.isFinite(difference)?difference:null,
    distinctDates:Number.isInteger(distinctDates)?distinctDates:null,
    maxDrawdownPct:Number.isFinite(drawdown)?drawdown:null,
    improvementProven:false,productionApproval:false,autoApply:false,productionWrites:false,
    note:"Descriptive triage only. No shared dataset identity, independent replication, statistical significance, or real trading profitability is established by this function.",
  };
}
