// Shadow-only descriptive regime replication; does not infer market regimes from returns.
import {assessMarketBreadthStatisticalReadiness} from './marketBreadthStatisticalReadiness.mjs';
const regimes=['RISING','FALLING','SIDEWAYS'];
export function assessMarketBreadthRegimeReplication({observations=[],minPerRegime=30,minDatesPerRegime=10}={}){
 if(!Array.isArray(observations)||observations.length>100000)throw new TypeError('INVALID_REGIME_OBSERVATIONS');
 const duplicateIds=new Set(),seen=new Set();
 for(const row of observations){const id=row?.signalRecordId;if(typeof id==='string'){if(seen.has(id))duplicateIds.add(id);seen.add(id)}}
 const results={};let total=0;
 for(const regime of regimes){
  const rows=observations.filter(x=>x?.marketRegime===regime&&!duplicateIds.has(x.signalRecordId)&&x.regimeSourceVerified===true);
  const summary=assessMarketBreadthStatisticalReadiness({observations:rows,minSignals:minPerRegime,minTradeDates:minDatesPerRegime,minMonths:1});
  results[regime]={sampleCount:summary.counts.valid,tradeDates:summary.counts.tradeDates,meanFiveSessionReturnPercent:summary.metrics.meanFiveSessionReturnPercent,medianFiveSessionReturnPercent:summary.metrics.medianFiveSessionReturnPercent,positiveRate:summary.metrics.positiveRate,meetsSampleThresholds:summary.statisticallyReadyForIndependentReview};
  total+=summary.counts.valid;
 }
 const ready=regimes.every(regime=>results[regime].meetsSampleThresholds);
 return {researchOnly:true,productionEligible:false,notificationEligible:false,aiPromotionAuthorized:false,regimeReplicationSampleReady:ready,independentRegimeReplicationVerified:false,usableObservations:total,excludedObservations:observations.length-total,regimes:results,missing:ready?['OUT_OF_SAMPLE_REPLICATION','INDEPENDENT_REGIME_ATTESTATION']:['MINIMUM_SAMPLE_PER_REGIME','OUT_OF_SAMPLE_REPLICATION','INDEPENDENT_REGIME_ATTESTATION']};
}
