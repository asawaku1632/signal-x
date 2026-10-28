// Pure read-only legacy evidence inventory; counts do not imply independent provenance.
export function assessMarketBreadthLegacyEvidenceReadiness({bbEvents=0,technicalEvents=0,bbResults=0,technicalResults=0,featureCaptures=0,verifiedOutcomePairs=0,verifiedTradeDates=0,originalSignalTimestampsVerified=false,providerRightsIndependentlyVerified=false}={}){
 const fields={bbEvents,technicalEvents,bbResults,technicalResults,featureCaptures,verifiedOutcomePairs,verifiedTradeDates};
 if(Object.values(fields).some(v=>!Number.isSafeInteger(v)||v<0))throw new TypeError('INVALID_LEGACY_EVIDENCE_COUNTS');
 const independentReady=originalSignalTimestampsVerified===true&&providerRightsIndependentlyVerified===true&&verifiedOutcomePairs>=30&&verifiedTradeDates>=10;
 return {researchOnly:true,productionEligible:false,notificationEligible:false,aiPromotionAuthorized:false,
  inventory:fields,independentEvidenceReadyForManualReview:independentReady,verifiedImprovement:false,
  missing:[...(originalSignalTimestampsVerified?[]:['ORIGINAL_SIGNAL_GENERATION_TIMESTAMPS']),...(providerRightsIndependentlyVerified?[]:['INDEPENDENT_PROVIDER_RIGHTS_VERIFICATION']),...(verifiedOutcomePairs>=30?[]:['MINIMUM_VERIFIED_OUTCOME_PAIRS']),...(verifiedTradeDates>=10?[]:['MINIMUM_VERIFIED_TRADE_DATES']),'OUT_OF_SAMPLE_BASELINE_COMPARISON','EXTERNAL_AUDITOR_REVIEW']};
}
