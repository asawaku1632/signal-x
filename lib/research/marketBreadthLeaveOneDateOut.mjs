// Shadow-only leave-one-date-out stress check; not a significance test or AI promotion gate.
import {reviewMarketBreadthSelectionSensitivity} from './marketBreadthSelectionSensitivity.mjs';
export function reviewMarketBreadthLeaveOneDateOut({pairs=[],verifiedSessions=[],minSelectedDates=10}={}){
 if(!Number.isSafeInteger(minSelectedDates)||minSelectedDates<2)throw new TypeError('INVALID_MIN_SELECTED_DATES');
 const base=reviewMarketBreadthSelectionSensitivity({pairs,verifiedSessions,minSelectedDates});
 const results={};
 for(const rule of base.selectionRules){
  const selected=base.results[rule].selected;
  const full=base.results[rule].meanPairedDeltaPercentagePoints;
  const omitted=selected.map((row,i)=>{
   const remaining=selected.filter((_,j)=>i!==j);
   const mean=remaining.length?remaining.reduce((sum,r)=>sum+r.delta,0)/remaining.length:null;
   return {omittedTradeDate:row.date,remainingDates:remaining.length,meanPairedDeltaPercentagePoints:mean};
  });
  const means=omitted.map(x=>x.meanPairedDeltaPercentagePoints).filter(x=>x!==null);
  results[rule]={fullMean:full,selectedDates:selected.length,allOmissionsMeetThreshold:selected.length-1>=minSelectedDates,
   worstLeaveOneDateOutMean:means.length?Math.min(...means):null,bestLeaveOneDateOutMean:means.length?Math.max(...means):null,
   positiveAfterEveryOmission:means.length>0&&means.every(v=>v>0),omitted};
 }
 const robust=base.selectionRules.every(rule=>results[rule].allOmissionsMeetThreshold&&results[rule].positiveAfterEveryOmission);
 return {researchOnly:true,productionEligible:false,notificationEligible:false,aiPromotionAuthorized:false,
  descriptiveLeaveOneDateOutPositive:robust,independentImprovementVerified:false,results,
  limitations:['SENSITIVITY_IS_NOT_STATISTICAL_SIGNIFICANCE','NO_EXTERNAL_AUDIT','NO_TRANSACTION_COSTS','NO_PRODUCTION_PROMOTION']};
}
