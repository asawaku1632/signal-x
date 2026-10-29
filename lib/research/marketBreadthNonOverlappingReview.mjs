// Shadow-only sensitivity analysis: select one deterministic, non-overlapping forward window per date.
// This is not a random sample and cannot establish causal model superiority.
import {auditMarketBreadthFiveSessionOverlap} from './marketBreadthOverlapAudit.mjs';
export function reviewMarketBreadthNonOverlapping({pairs=[],verifiedSessions=[],minSelectedDates=10}={}){
 if(!Number.isSafeInteger(minSelectedDates)||minSelectedDates<1)throw new TypeError('INVALID_MIN_SELECTED_DATES');
 const audit=auditMarketBreadthFiveSessionOverlap({pairs,verifiedSessions});
 const byDate=new Map();
 for(const w of audit.windows){const group=byDate.get(w.tradeDate)??[];group.push(w);byDate.set(w.tradeDate,group)}
 const selected=[],skipped=[],dates=[...byDate.keys()].sort();
 let lastExit=-1;
 for(const date of dates){
  const candidates=byDate.get(date).sort((a,b)=>a.code.localeCompare(b.code)||a.index-b.index);
  const first=candidates[0];
  if(first.start<lastExit){for(const w of candidates)skipped.push({index:w.index,reason:'OVERLAPPING_FIVE_SESSION_WINDOW'});continue}
  selected.push(first);lastExit=first.end;
  for(const w of candidates.slice(1))skipped.push({index:w.index,reason:'SAME_DATE_CLUSTER_EXCLUDED'});
 }
 const deltas=selected.map(w=>pairs[w.index].researchReturnPercent-pairs[w.index].baselineReturnPercent);
 const n=deltas.length,mean=n?deltas.reduce((a,b)=>a+b,0)/n:null;
 const sorted=deltas.slice().sort((a,b)=>a-b);
 const median=n?(sorted[Math.floor((n-1)/2)]+sorted[Math.floor(n/2)])/2:null;
 return {researchOnly:true,productionEligible:false,notificationEligible:false,aiPromotionAuthorized:false,
  selectedCount:n,skippedCount:skipped.length,blockedCount:audit.blockedWindows,
  nonOverlappingSampleReady:n>=minSelectedDates,meanPairedDeltaPercentagePoints:mean,medianPairedDeltaPercentagePoints:median,
  positiveDeltaRate:n?deltas.filter(v=>v>0).length/n:null,
  selected: selected.map(w=>({index:w.index,code:w.code,tradeDate:w.tradeDate,exitTradeDate:w.exitTradeDate})),skipped,
  limitations:['DETERMINISTIC_FIRST_CODE_SELECTION_BIAS','NO_COMPARISON_TO_ALTERNATIVE_SELECTION_RULES','INDEPENDENT_SOURCE_AUDIT_REQUIRED','NO_MODEL_PROMOTION']};
}
