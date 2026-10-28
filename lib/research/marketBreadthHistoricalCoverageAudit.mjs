// Shadow-only historical coverage audit: distinguish descriptive records from forward evidence.
const validDay=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
export function auditMarketBreadthHistoricalCoverage({buckets=[]}={}){
 if(!Array.isArray(buckets)||buckets.length>10000)throw new TypeError('INVALID_HISTORICAL_BUCKETS');
 const seen=new Set(),accepted=[],rejected=[];
 for(let index=0;index<buckets.length;index++){
  const x=buckets[index];
  if(!x||!['BB','TECHNICAL'].includes(x.source)||!validDay(x.tradeDate)||!Number.isSafeInteger(x.eventCount)||x.eventCount<0||!Number.isSafeInteger(x.verifiedOutcomeCount)||x.verifiedOutcomeCount<0||x.verifiedOutcomeCount>x.eventCount){rejected.push({index,reason:'INVALID_BUCKET'});continue}
  const key=x.source+':'+x.tradeDate;
  if(seen.has(key)){rejected.push({index,reason:'DUPLICATE_SOURCE_DATE'});continue}
  seen.add(key);
  accepted.push({source:x.source,tradeDate:x.tradeDate,eventCount:x.eventCount,verifiedOutcomeCount:x.verifiedOutcomeCount});
 }
 const events=accepted.reduce((a,x)=>a+x.eventCount,0),outcomes=accepted.reduce((a,x)=>a+x.verifiedOutcomeCount,0);
 const days=new Set(accepted.filter(x=>x.eventCount>0).map(x=>x.tradeDate));
 const verifiedDays=new Set(accepted.filter(x=>x.verifiedOutcomeCount>0).map(x=>x.tradeDate));
 return {researchOnly:true,productionEligible:false,notificationEligible:false,aiPromotionAuthorized:false,
  counts:{submittedBuckets:buckets.length,acceptedBuckets:accepted.length,rejectedBuckets:rejected.length,events,verifiedOutcomes:outcomes,distinctEventDates:days.size,distinctVerifiedOutcomeDates:verifiedDays.size},
  outcomeCoverageRatio:events?outcomes/events:null,descriptiveOnly:outcomes===0,independentImprovementVerified:false,accepted,rejected,
  limitations:['OUTCOME_COUNTS_ARE_CALLER_SUPPLIED_NOT_AUDITED','NO_ORIGINAL_GENERATION_TIMESTAMP_VERIFICATION','NO_PROVIDER_LICENSE_VERIFICATION','NO_AI_PROMOTION']};
}
