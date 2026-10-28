// Fail-closed synthesis of rule sensitivity; never authorizes AI promotion.
import {reviewMarketBreadthSelectionSensitivity} from './marketBreadthSelectionSensitivity.mjs';
export function assessMarketBreadthSelectionRobustness(input={}){
 const review=reviewMarketBreadthSelectionSensitivity(input);
 const summaries=review.selectionRules.map(rule=>({rule,ready:review.results[rule].sampleReady,
  meanDelta:review.results[rule].meanPairedDeltaPercentagePoints,
  positiveDateRate:review.results[rule].positiveDateRate}));
 const ready=review.allRulesSampleReady;
 const positive=review.descriptivePositiveAcrossRules;
 const missing=[...(!ready?['MINIMUM_DISJOINT_DATES_ACROSS_RULES']:[]),...(!positive?['POSITIVE_DELTA_NOT_REPLICATED_ACROSS_RULES']:[]),
  'INDEPENDENT_OUTCOME_ATTESTATION','UNTOUCHED_TEMPORAL_HOLDOUT','MULTIPLE_TESTING_CORRECTION','EXECUTION_COST_VALIDATION'];
 return {researchOnly:true,productionEligible:false,notificationEligible:false,aiPromotionAuthorized:false,
  descriptiveSelectionRobustnessObserved:ready&&positive,verifiedSelectionRobustness:false,ruleSummaries:summaries,missing};
}
