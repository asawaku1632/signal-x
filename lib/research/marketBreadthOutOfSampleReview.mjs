// Offline chronological holdout review. Never train on or promote the holdout.
import {assessMarketBreadthStatisticalReadiness} from './marketBreadthStatisticalReadiness.mjs';
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
export function reviewMarketBreadthOutOfSample({observations=[],trainingEndDate,holdoutStartDate,minHoldoutSignals=30,minHoldoutDates=10}={}){
 if(!validDate(trainingEndDate)||!validDate(holdoutStartDate)||trainingEndDate>=holdoutStartDate)throw new TypeError('INVALID_CHRONOLOGICAL_SPLIT');
 if(!Array.isArray(observations)||observations.length>100000)throw new TypeError('INVALID_OUT_OF_SAMPLE_OBSERVATIONS');
 const training=[],holdout=[],excluded=[];
 const owners=new Map();
 for(const x of observations){if(typeof x?.signalRecordId==='string'){owners.set(x.signalRecordId,(owners.get(x.signalRecordId)??0)+1)}}
 for(let index=0;index<observations.length;index++){
  const x=observations[index];
  if(!validDate(x?.tradeDate)||typeof x?.signalRecordId!=='string'||owners.get(x.signalRecordId)!==1){excluded.push({index,reason:'INVALID_OR_DUPLICATE_IDENTITY'});continue}
  if(x.tradeDate<=trainingEndDate)training.push(x);
  else if(x.tradeDate>=holdoutStartDate)holdout.push(x);
  else excluded.push({index,reason:'EMBARGO_PERIOD'});
 }
 const train=assessMarketBreadthStatisticalReadiness({observations:training,minSignals:1,minTradeDates:1,minMonths:1});
 const test=assessMarketBreadthStatisticalReadiness({observations:holdout,minSignals:minHoldoutSignals,minTradeDates:minHoldoutDates,minMonths:1});
 const sampleReady=test.statisticallyReadyForIndependentReview;
 return {researchOnly:true,productionEligible:false,notificationEligible:false,aiPromotionAuthorized:false,outOfSampleSampleReady:sampleReady,independentReplicationVerified:false,
  split:{trainingEndDate,holdoutStartDate,embargoedCount:excluded.filter(x=>x.reason==='EMBARGO_PERIOD').length},
  training:{counts:train.counts,metrics:train.metrics},holdout:{counts:test.counts,metrics:test.metrics},excluded,
  missing:[...(sampleReady?[]:['MIN_HOLDOUT_SAMPLE']), 'PREDICTION_TIMESTAMP_AUDIT','LEAKAGE_AUDIT','INDEPENDENT_SOURCE_AND_OUTCOME_AUDIT']};
}
