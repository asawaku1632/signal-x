// Shadow-only deterministic sensitivity to non-overlapping selection rules.
// No selection is chosen based on observed returns.
import {auditMarketBreadthFiveSessionOverlap} from './marketBreadthOverlapAudit.mjs';
const rules=['CODE_ASC','CODE_DESC','ALL_DATE_MEAN'];
export function reviewMarketBreadthSelectionSensitivity({pairs=[],verifiedSessions=[],minSelectedDates=10}={}){
 if(!Number.isSafeInteger(minSelectedDates)||minSelectedDates<1)throw new TypeError('INVALID_MIN_SELECTED_DATES');
 const audit=auditMarketBreadthFiveSessionOverlap({pairs,verifiedSessions});
 const groups=new Map();
 for(const w of audit.windows){const a=groups.get(w.tradeDate)??[];a.push(w);groups.set(w.tradeDate,a)}
 const dates=[...groups.keys()].sort();
 const results={};
 for(const rule of rules){
  const selected=[],skipped=[];let lastExit=-1;
  for(const date of dates){
   const candidates=[...groups.get(date)].sort((a,b)=>a.code.localeCompare(b.code)||a.index-b.index);
   if(candidates[0].start<lastExit){skipped.push(...candidates.map(x=>x.index));continue}
   const chosen=rule==='CODE_ASC'?candidates[0]:rule==='CODE_DESC'?candidates[candidates.length-1]:null;
   const deltas=(chosen?[chosen]:candidates).map(w=>pairs[w.index].researchReturnPercent-pairs[w.index].baselineReturnPercent);
   selected.push({date,indices:(chosen?[chosen]:candidates).map(w=>w.index),delta:deltas.reduce((a,b)=>a+b,0)/deltas.length});
   lastExit=candidates[0].end;
   if(chosen)skipped.push(...candidates.filter(w=>w.index!==chosen.index).map(w=>w.index));
  }
  const n=selected.length,values=selected.map(x=>x.delta).sort((a,b)=>a-b);
  results[rule]={selectedDates:n,selectedObservations:selected.reduce((a,x)=>a+x.indices.length,0),skippedObservations:skipped.length,
   sampleReady:n>=minSelectedDates,meanPairedDeltaPercentagePoints:n?values.reduce((a,b)=>a+b,0)/n:null,
   medianPairedDeltaPercentagePoints:n?(values[Math.floor((n-1)/2)]+values[Math.floor(n/2)])/2:null,
   positiveDateRate:n?values.filter(v=>v>0).length/n:null,selected};
 }
 const means=rules.map(r=>results[r].meanPairedDeltaPercentagePoints);
 const allReady=rules.every(r=>results[r].sampleReady);
 const consistentPositive=allReady&&means.every(x=>x!==null&&x>0);
 return {researchOnly:true,productionEligible:false,notificationEligible:false,aiPromotionAuthorized:false,
  selectionRules:rules,results,allRulesSampleReady:allReady,descriptivePositiveAcrossRules:consistentPositive,
  independentlyVerifiedImprovement:false,blockedPairs:audit.blockedWindows,
  limitations:['RULES_ARE_NOT_RANDOMIZED','ALL_DATE_MEAN_IS_NOT_AN_EXECUTABLE_SINGLE_TRADE_STRATEGY','WINDOW_SELECTION_IS_GREEDY','OUT_OF_SAMPLE_AND_EXTERNAL_AUDIT_REQUIRED','NO_TRANSACTION_COSTS']};
}
