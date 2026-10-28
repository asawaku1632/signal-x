// Offline, fail-closed forward outcome linkage. No exchange calendar is inferred.
import {preflightMarketBreadthProspectiveForward} from './marketBreadthProspectiveForwardGate.mjs';
const day=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
export function linkMarketBreadthProspectiveFiveSessionOutcomes(entries,outcomes,{verifiedSessions=[]}={}){
 const preflight=preflightMarketBreadthProspectiveForward(entries);
 if(!Array.isArray(outcomes)||!Array.isArray(verifiedSessions))throw new TypeError('INVALID_FORWARD_INPUT');
 const validCalendar=verifiedSessions.length>0&&verifiedSessions.every(day)&&new Set(verifiedSessions).size===verifiedSessions.length&&verifiedSessions.every((d,i)=>i===0||verifiedSessions[i-1]<d);
 const bySignal=new Map(),linked=[],blocked=[];
 for(const outcome of outcomes){if(outcome&&typeof outcome.signalRecordId==='string'){const list=bySignal.get(outcome.signalRecordId)??[];list.push(outcome);bySignal.set(outcome.signalRecordId,list)}}
 for(const candidate of preflight.candidates){
  const found=bySignal.get(candidate.signalRecordId)??[];
  let reason='INDEPENDENT_EVIDENCE_NOT_ATTESTED';
  if(!validCalendar)reason='VERIFIED_EXCHANGE_CALENDAR_MISSING';
  else if(found.length!==1)reason=found.length?'DUPLICATE_OUTCOME':'OUTCOME_MISSING';
  else{
   const outcome=found[0];
   const i=verifiedSessions.indexOf(candidate.tradeDate);
   if(i<0||i+5>=verifiedSessions.length)reason='FIVE_VERIFIED_SESSIONS_NOT_AVAILABLE';
   else if(outcome.code!==candidate.code||outcome.tradeDate!==candidate.tradeDate||outcome.outcomeTradeDate!==verifiedSessions[i+5])reason='OUTCOME_BINDING_MISMATCH';
   else if(outcome.independentVerification!==true||outcome.providerRightsVerified!==true)reason='INDEPENDENT_EVIDENCE_NOT_ATTESTED';
   else if(typeof outcome.entryPrice!=='number'||!Number.isFinite(outcome.entryPrice)||outcome.entryPrice<=0||typeof outcome.exitPrice!=='number'||!Number.isFinite(outcome.exitPrice)||outcome.exitPrice<=0)reason='INVALID_OUTCOME_PRICES';
   else {linked.push({index:candidate.index,signalRecordId:candidate.signalRecordId,outcomeTradeDate:outcome.outcomeTradeDate,returnPercent:(outcome.exitPrice/outcome.entryPrice-1)*100,verificationStatus:'SELF_ATTESTED_REQUIRES_EXTERNAL_AUDIT',productionEligible:false});continue}
  }
  blocked.push({index:candidate.index,signalRecordId:candidate.signalRecordId,reason});
 }
 return {researchOnly:true,productionEligible:false,notificationEligible:false,externallyVerifiedCount:0,internallyLinkedCount:linked.length,blockedCount:blocked.length,linked,blocked,rejected:preflight.rejected};
}
