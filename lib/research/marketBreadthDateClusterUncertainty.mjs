// Offline date-cluster descriptive uncertainty. No production promotion or significance certification.
import {compareMarketBreadthPairedBaseline} from './marketBreadthPairedBaselineComparison.mjs';
export function assessMarketBreadthDateClusterUncertainty({pairs=[],minDates=10}={}){
 const base=compareMarketBreadthPairedBaseline({pairs,minPairs:1,minDates:1});
 const rejected=new Set(base.rejected.map(x=>x.index));
 const groups=new Map();
 for(let i=0;i<pairs.length;i++){
  if(rejected.has(i))continue;
  const x=pairs[i],delta=x.researchReturnPercent-x.baselineReturnPercent;
  const group=groups.get(x.tradeDate)??[];group.push(delta);groups.set(x.tradeDate,group);
 }
 const daily=[...groups].sort(([a],[b])=>a.localeCompare(b)).map(([date,values])=>({date,count:values.length,meanDelta:values.reduce((a,b)=>a+b,0)/values.length}));
 const n=daily.length,mean=n?daily.reduce((a,x)=>a+x.meanDelta,0)/n:null;
 const variance=n>1?daily.reduce((a,x)=>a+(x.meanDelta-mean)**2,0)/(n-1):null;
 const se=variance===null?null:Math.sqrt(variance/n);
 return {researchOnly:true,productionEligible:false,notificationEligible:false,aiPromotionAuthorized:false,
  sampleReady:n>=minDates,independentImprovementVerified:false,
  pairedCount:base.counts.validPairs,clusterCount:n,meanOfDailyPairedDeltas:mean,
  dateClusterStandardError:se,approximate95PercentInterval:se===null?null:{lower:mean-1.96*se,upper:mean+1.96*se,method:'EQUAL_DATE_WEIGHT_NORMAL_APPROXIMATION'},
  limitations:['DATE_CLUSTERS_MAY_BE_SERIAL_CORRELATED','FEW_CLUSTER_NORMAL_APPROXIMATION','EQUAL_DATE_WEIGHT_DIFFERS_FROM_TRADE_WEIGHT','MULTIPLE_TESTING_NOT_CORRECTED','DATA_PROVENANCE_NOT_EXTERNALLY_AUDITED']};
}
