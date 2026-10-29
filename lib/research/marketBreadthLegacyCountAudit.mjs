// Aggregate inventory only: never upgrades legacy backfills to verified forward predictions.
const count=n=>Number.isSafeInteger(n)&&n>=0;
export function auditMarketBreadthLegacyCounts({bbSignals,technicalSignals,scanCaptures,bbFiveDayResults,technicalFiveDayResults,bbAfterSignalDate,technicalAfterSignalDate}={}){
 const values={bbSignals,technicalSignals,scanCaptures,bbFiveDayResults,technicalFiveDayResults,bbAfterSignalDate,technicalAfterSignalDate};
 if(!Object.values(values).every(count))throw new Error('INVALID_LEGACY_COUNT');
 if(bbAfterSignalDate>bbSignals||technicalAfterSignalDate>technicalSignals||bbFiveDayResults>bbSignals||technicalFiveDayResults>technicalSignals)throw new Error('INCONSISTENT_LEGACY_COUNT');
 return {researchOnly:true,productionEligible:false,notificationEligible:false,signalCount:bbSignals+technicalSignals,scanCaptures,recordedAfterNominalDate:bbAfterSignalDate+technicalAfterSignalDate,reportedFiveDayResults:bbFiveDayResults+technicalFiveDayResults,independentlyVerifiedForwardOutcomes:null,verificationStatus:'NOT_DETERMINABLE_FROM_COUNTS',historicalResearchUse:'DESCRIPTIVE_ONLY',forwardProofUse:'BLOCKED_UNTIL_RECORD_LEVEL_ATTESTATION'};
}
