/** Research-only provider readiness gate. No fetching, secrets, cron or database writes. */
export function assessIntradayProviderReadiness(input = {}) {
  const {provider, permission, intradayAvailable, timestamped, coverageVerified, costApproved} = input;
  if(typeof provider!=="string"||!provider.trim()) return {status:"BLOCKED",reason:"NO_PROVIDER"};
  if(permission!=="APPROVED") return {status:"BLOCKED",reason:"PROVIDER_APPROVAL_REQUIRED"};
  if(intradayAvailable!==true) return {status:"BLOCKED",reason:"INTRADAY_DATA_UNAVAILABLE"};
  if(timestamped!==true) return {status:"BLOCKED",reason:"TIMESTAMP_VERIFICATION_REQUIRED"};
  if(coverageVerified!==true) return {status:"BLOCKED",reason:"COVERAGE_VERIFICATION_REQUIRED"};
  if(costApproved!==true) return {status:"BLOCKED",reason:"COST_APPROVAL_REQUIRED"};
  return {status:"READY_FOR_ISOLATED_REVIEW",provider,autoCollectionEnabled:false,
    productionEnabled:false,ordersEnabled:false};
}
