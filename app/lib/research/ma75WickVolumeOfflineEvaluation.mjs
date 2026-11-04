import {classifyMa75WickVolume,auditMa75FillAndBudget,MA75_WICK_VOLUME_V1 as rule} from './ma75WickVolumeForward.mjs';
/** Offline research only. Historical results must not be used for notifications. */
export function evaluateMa75HistoricalSeries({bars,provenanceByTime={}}={}){
 if(!Array.isArray(bars))return {status:'INVALID_INPUT',rows:[],summary:null};
 const rows=[];const exclusions={};
 const observedDates=new Set();
 for(let i=75;i<bars.length;i++){
  const today=bars.slice(i-74,i+1),prior=bars.slice(i-75,i);
  if(Number.isSafeInteger(bars[i]?.time)) observedDates.add(bars[i].time);
  if(today.length!==75||prior.length!==75||![...today,...prior].every(b=>Number.isFinite(b?.close)&&b.close>0))continue;
  const ma75Today=today.reduce((s,b)=>s+b.close,0)/75;
  const ma75Prior=prior.reduce((s,b)=>s+b.close,0)/75;
  const provenance=Object.hasOwn(provenanceByTime,bars[i]?.time)?provenanceByTime[bars[i].time]:null;
  const classification=classifyMa75WickVolume({bars,signalIndex:i,ma75Today,ma75Prior,provenance});
  if(classification.status!=='SHADOW_ONLY'){exclusions[classification.status]=(exclusions[classification.status]||0)+1;continue}
  if(!classification.eligible)continue;
  const outcome=auditMa75FillAndBudget({bars,signalIndex:i});
  rows.push({signalTime:bars[i].time,signalIndex:i,upperWickRatio:classification.upperWickRatio,volumeRatio:classification.volumeRatio,provenanceStatus:classification.provenanceStatus,outcomeStatus:outcome.status,budgetEligible:outcome.budgetEligible===true,minLots:outcome.minLots??null,maxLots:outcome.maxLots??null,returnPercent:outcome.status==='HYPOTHETICAL_ONLY'?outcome.grossReturnPercent:null});
 }
 const measured=rows.filter(r=>r.outcomeStatus==='HYPOTHETICAL_ONLY'&&r.budgetEligible&&Number.isFinite(r.returnPercent));
 return {status:'OFFLINE_SHADOW_ONLY',rows,summary:{candidateCount:rows.length,observedSessionCount:observedDates.size,measuredCount:measured.length,pendingCount:rows.filter(r=>r.outcomeStatus==='PENDING').length,excludedCount:Object.values(exclusions).reduce((a,b)=>a+b,0),exclusions,meanReturnPercent:measured.length?measured.reduce((s,r)=>s+r.returnPercent,0)/measured.length:null,positiveRatePercent:measured.length?100*measured.filter(r=>r.returnPercent>0).length/measured.length:null,negativeCount:measured.filter(r=>r.returnPercent<0).length,zeroCount:measured.filter(r=>r.returnPercent===0).length,minReturnPercent:measured.length?Math.min(...measured.map(r=>r.returnPercent)):null,maxReturnPercent:measured.length?Math.max(...measured.map(r=>r.returnPercent)):null,executionVerified:false,forwardValidated:false}};
}
