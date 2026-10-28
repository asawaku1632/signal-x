// Offline paired uncertainty summary. Normal approximation is descriptive, not proof of superiority.
import {compareMarketBreadthPairedBaseline} from './marketBreadthPairedBaselineComparison.mjs';
export function assessMarketBreadthPairedUncertainty({pairs=[],minPairs=30,minDates=10}={}){
 const base=compareMarketBreadthPairedBaseline({pairs,minPairs,minDates});
 const rejected=new Set(base.rejected.map(x=>x.index));
 const values=pairs.filter((_,i)=>!rejected.has(i)).map(x=>x.researchReturnPercent-x.baselineReturnPercent);
 const n=values.length,mean=base.metrics.meanPairedDeltaPercentagePoints;
 const variance=n>1?values.reduce((sum,v)=>sum+(v-mean)**2,0)/(n-1):null;
 const se=variance===null?null:Math.sqrt(variance/n);
 const interval=se===null?null:{lower:mean-1.96*se,upper:mean+1.96*se,method:'NORMAL_APPROXIMATION_NOT_CLUSTER_ROBUST'};
 const allPositive=interval!==null&&interval.lower>0;
 return {researchOnly:true,productionEligible:false,notificationEligible:false,aiPromotionAuthorized:false,
  sampleReady:base.pairedSampleReady,pairedCount:n,meanPairedDeltaPercentagePoints:mean,sampleVariance:variance,standardError:se,approximate95PercentInterval:interval,
  descriptivePositiveInterval:allPositive,statisticallyValidatedImprovement:false,
  limitations:['SHARED_TRADE_DATE_DEPENDENCE_NOT_MODELED','MULTIPLE_HYPOTHESIS_TESTING_NOT_CORRECTED','OUT_OF_SAMPLE_REPLICATION_REQUIRED','EXECUTION_COSTS_NOT_MODELED','SOURCE_ATTESTATION_REQUIRES_EXTERNAL_AUDIT']};
}
