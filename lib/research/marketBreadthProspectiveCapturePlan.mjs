// Pure prospective capture readiness assessment. This is not a capture writer.
const required=['generatorTimestampAtCreation','sourceObservedAt','sourceBarEndAt','licensedProviderRightsEvidence','immutableSourceRecord','immutableSignalRecord','securityCodeBound','exchangeSessionCalendar','independentFiveSessionOutcome'];
export function assessMarketBreadthProspectiveCaptureReadiness(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('INVALID_CAPTURE_READINESS_INPUT');
 const checks=required.map(key=>({requirement:key,verified:input[key]===true}));
 const missing=checks.filter(x=>!x.verified).map(x=>x.requirement);
 return {researchOnly:true,productionEligible:false,notificationEligible:false,captureReady:missing.length===0,liveIntegrationAuthorized:false,verifiedRequirements:checks.length-missing.length,totalRequirements:checks.length,missing};
}
