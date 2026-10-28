// Research-only policy classification; not proof that a user has a provider license.
// Delayed historical data must never be relabeled as live as-of or five-session forward observations.
export function classifyResearchDataUse(input) {
  const provider = String(input?.provider ?? "").trim().toUpperCase();
  const purpose = String(input?.purpose ?? "").trim().toUpperCase();
  const delayWeeks = input?.delayWeeks;
  const permitted = input?.permissionEvidence === "VERIFIED_DOCUMENTED_PERMISSION";
  if (!provider || !["HISTORICAL_BACKTEST","PROSPECTIVE_CAPTURE","FORWARD_OUTCOME"].includes(purpose))
    return {allowed:false,reason:"INVALID_RESEARCH_USE",verified:false};
  if (provider.includes("YAHOO"))
    return {allowed:false,reason:"YAHOO_AUTOMATED_RESEARCH_NOT_AUTHORIZED",verified:false};
  if (!permitted)
    return {allowed:false,reason:"PROVIDER_PERMISSION_NOT_DOCUMENTED",verified:false};
  if (!Number.isFinite(delayWeeks) || delayWeeks < 0)
    return {allowed:false,reason:"UNKNOWN_DATA_DELAY",verified:false};
  if (delayWeeks > 0 && purpose !== "HISTORICAL_BACKTEST")
    return {allowed:false,reason:"DELAYED_DATA_NOT_PROSPECTIVE",verified:false};
  return {
    allowed:true,reason:"PERMISSION_AND_DELAY_DECLARED_REQUIRES_INDEPENDENT_AUDIT",
    verified:false,independent_provenance_verified:false,
    eligible_for_live_ai:false
  };
}
