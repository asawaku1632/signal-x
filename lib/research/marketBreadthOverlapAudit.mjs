// Shadow-only audit for overlapping forward five-session outcome windows.
// Explicit ordered exchange sessions required; do not infer calendar dates.
import {compareMarketBreadthPairedBaseline} from './marketBreadthPairedBaselineComparison.mjs';
const validDay=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
export function auditMarketBreadthFiveSessionOverlap({pairs=[],verifiedSessions=[]}={}){
 if(!Array.isArray(verifiedSessions)||!verifiedSessions.length||verifiedSessions.some(d=>!validDay(d))||new Set(verifiedSessions).size!==verifiedSessions.length||verifiedSessions.some((d,i)=>i&&verifiedSessions[i-1]>=d))throw new TypeError('VERIFIED_EXCHANGE_SESSIONS_REQUIRED');
 const base=compareMarketBreadthPairedBaseline({pairs,minPairs:1,minDates:1});
 const rejected=new Set(base.rejected.map(x=>x.index)),windows=[],blocked=[];
 for(let index=0;index<pairs.length;index++){
  if(rejected.has(index)){blocked.push({index,reason:'UNVERIFIED_PAIR'});continue}
  const x=pairs[index],start=verifiedSessions.indexOf(x.tradeDate);
  if(start<0||start+5>=verifiedSessions.length){blocked.push({index,reason:'FIVE_VERIFIED_SESSIONS_UNAVAILABLE'});continue}
  windows.push({index,code:x.code,tradeDate:x.tradeDate,exitTradeDate:verifiedSessions[start+5],start,end:start+5});
 }
 let overlapPairs=0,overlappingObservations=new Set();
 for(let i=0;i<windows.length;i++)for(let j=i+1;j<windows.length;j++){
  if(Math.max(windows[i].start,windows[j].start)<Math.min(windows[i].end,windows[j].end)){overlapPairs++;overlappingObservations.add(windows[i].index);overlappingObservations.add(windows[j].index)}
 }
 return {researchOnly:true,productionEligible:false,notificationEligible:false,aiPromotionAuthorized:false,
  auditedWindows:windows.length,blockedWindows:blocked.length,overlappingWindowPairs:overlapPairs,observationsWithOverlap:overlappingObservations.size,
  overlapDetected:overlapPairs>0,independentImprovementVerified:false,windows,blocked,
  limitations:['SESSION_LIST_AUTHORITY_NOT_EXTERNALLY_VERIFIED','OVERLAP_IS_NOT_PROOF_OF_STATISTICAL_DEPENDENCE','NO_MODEL_PROMOTION']};
}
