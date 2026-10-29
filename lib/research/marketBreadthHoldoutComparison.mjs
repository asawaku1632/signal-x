// Descriptive holdout comparison. No causal attribution, significance claim or model promotion.
import {reviewMarketBreadthOutOfSample} from './marketBreadthOutOfSampleReview.mjs';
export function compareMarketBreadthHoldoutPerformance(input={}){
 const result=reviewMarketBreadthOutOfSample(input);
 const a=result.training.metrics,b=result.holdout.metrics;
 const diff=(x,y)=>x===null||y===null?null:y-x;
 const comparison={meanReturnDeltaPercentagePoints:diff(a.meanFiveSessionReturnPercent,b.meanFiveSessionReturnPercent),
 medianReturnDeltaPercentagePoints:diff(a.medianFiveSessionReturnPercent,b.medianFiveSessionReturnPercent),
 positiveRateDeltaPercentagePoints:diff(a.positiveRate,b.positiveRate)===null?null:100*diff(a.positiveRate,b.positiveRate)};
 const valid=result.training.counts.valid>0&&result.holdout.counts.valid>0;
 const deterioration=valid&&comparison.meanReturnDeltaPercentagePoints<0;
 return {researchOnly:true,productionEligible:false,notificationEligible:false,aiPromotionAuthorized:false,
  holdoutComparisonAvailable:valid,descriptiveMeanDeteriorationObserved:deterioration,comparison,
  training:result.training,holdout:result.holdout,
  interpretation:!valid?'INSUFFICIENT_VERIFIED_COMPARABLE_DATA':deterioration?'DESCRIPTIVE_HOLDOUT_MEAN_LOWER':'NO_DESCRIPTIVE_MEAN_DETERIORATION_DETECTED',
  limitations:['NOT_A_CAUSAL_IMPROVEMENT_ESTIMATE','NO_UNTOUCHED_BASELINE_COMPARATOR','NO_CONFIDENCE_INTERVAL_OR_MULTIPLE_TEST_CORRECTION','NO_INDEPENDENT_DATA_RIGHTS_AUDIT']};
}
