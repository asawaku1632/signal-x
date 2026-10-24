// Read-only readiness gate for prospective dual-surge research.
// This module never fetches market data or writes observations.
export function assessDualSurgeSourceReadiness({
 provider,licenseStatus,sourceVerified,completedDate,signalDate,
 calendarVersion,candles,code
}={}) {
 const reasons=[];
 if (!/^\d{4}$/.test(code||"")) reasons.push("INVALID_CODE");
 if (typeof provider!=="string"||!provider.trim()) reasons.push("PROVIDER_MISSING");
 if (licenseStatus!=="APPROVED") reasons.push("LICENSE_NOT_APPROVED");
 if (sourceVerified!==true) reasons.push("SOURCE_NOT_VERIFIED");
 if (!/^\d{4}-\d{2}-\d{2}$/.test(signalDate||"")||completedDate!==signalDate)
  reasons.push("SESSION_NOT_COMPLETED");
 if (typeof calendarVersion!=="string"||!calendarVersion.trim())
  reasons.push("CALENDAR_UNVERIFIED");
 if (!Array.isArray(candles)||candles.length<22) reasons.push("HISTORY_UNAVAILABLE");
 return {ready:reasons.length===0,reasons};
}
