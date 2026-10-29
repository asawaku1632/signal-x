// Research-only holdout sensitivity. Split first, then evaluate fixed rules on untouched later dates.
// Explicit embargo, identity quarantine and no inference of external source authority.
import {reviewMarketBreadthSelectionSensitivity} from './marketBreadthSelectionSensitivity.mjs';
const validDay=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
export function assessMarketBreadthHoldoutRuleRobustness({pairs=[],verifiedSessions=[],trainingEndDate,holdoutStartDate,minHoldoutDates=10}={}){
 if(!validDay(trainingEndDate)||!validDay(holdoutStartDate)||trainingEndDate>=holdoutStartDate)throw new TypeError('INVALID_CHRONOLOGICAL_SPLIT');
 if(!Array.isArray(pairs)||pairs.length>100000)throw new TypeError('INVALID_HOLDOUT_PAIRS');
 const identityOwners=new Map();
 for(const p of pairs)for(const id of [p?.signalRecordId,p?.baselineRecordId])if(typeof id==='string'&&id.trim())identityOwners.set(id,(identityOwners.get(id)??0)+1);
 const training=[],holdout=[],excluded=[];
 for(let index=0;index<pairs.length;index++){
  const p=pairs[index];
  if(!validDay(p?.tradeDate)||typeof p.signalRecordId!=='string'||typeof p.baselineRecordId!=='string'||!p.signalRecordId.trim()||!p.baselineRecordId.trim()||identityOwners.get(p.signalRecordId)!==1||identityOwners.get(p.baselineRecordId)!==1){excluded.push({index,reason:'INVALID_OR_REUSED_RECORD_ID'});continue}
  if(p.tradeDate<=trainingEndDate)training.push(p);
  else if(p.tradeDate>=holdoutStartDate)holdout.push(p);
  else excluded.push({index,reason:'EMBARGOED_DATE'});
 }
 const trainingReview=reviewMarketBreadthSelectionSensitivity({pairs:training,verifiedSessions,minSelectedDates:1});
 const holdoutReview=reviewMarketBreadthSelectionSensitivity({pairs:holdout,verifiedSessions,minSelectedDates:minHoldoutDates});
 const rules=holdoutReview.selectionRules;
 const summaries=rules.map(rule=>({rule,trainingMeanDelta:trainingReview.results[rule].meanPairedDeltaPercentagePoints,
  holdoutMeanDelta:holdoutReview.results[rule].meanPairedDeltaPercentagePoints,holdoutSelectedDates:holdoutReview.results[rule].selectedDates,
  holdoutSampleReady:holdoutReview.results[rule].sampleReady}));
 return {researchOnly:true,productionEligible:false,notificationEligible:false,aiPromotionAuthorized:false,
  chronologicalSplit:{trainingEndDate,holdoutStartDate},submitted:pairs.length,trainingCount:training.length,holdoutCount:holdout.length,
  excluded,holdoutAllRulesSampleReady:holdoutReview.allRulesSampleReady,
  descriptiveHoldoutPositiveAcrossRules:holdoutReview.descriptivePositiveAcrossRules,
  independentlyVerifiedImprovement:false,ruleSummaries:summaries,
  blockers:['INDEPENDENT_OUTCOME_AND_CALENDAR_AUDIT','UNTOUCHED_HOLDOUT_PROVENANCE','MULTIPLE_TESTING_AND_EXECUTION_COST_REVIEW']};
}
