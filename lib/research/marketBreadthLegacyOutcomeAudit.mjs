// Pure, read-only legacy outcome reconciliation. A matching result is NOT verified forward evidence.
const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const positive=x=>typeof x==='number'&&Number.isFinite(x)&&x>0;
export function auditLegacyOutcomeLinks(events,results,{kind}={}){
 if(!Array.isArray(events)||!Array.isArray(results)||!['bb','technical'].includes(kind))throw new TypeError('INVALID_LEGACY_OUTCOME_INPUT');
 const eventsById=new Map(),duplicateIds=new Set();
 for(const event of events){if(!Number.isSafeInteger(event?.id)){continue;}if(eventsById.has(event.id))duplicateIds.add(event.id);eventsById.set(event.id,event);}
 const counts={LINKED_UNVERIFIED:0,ORPHAN_RESULT:0,DUPLICATE_EVENT_ID:0,INVALID_EVENT_OR_RESULT:0,INVALID_HORIZON:0,INVALID_OUTCOME_DATE:0,INVALID_RETURN:0,DUPLICATE_OUTCOME:0};
 const seen=new Set(),duplicates=new Set();
 for(const result of results){const key=JSON.stringify([result?.event_id,result?.horizon]);if(seen.has(key))duplicates.add(key);seen.add(key);}
 const findings=[];
 for(const result of results){
  let reason;
  if(!Number.isSafeInteger(result?.event_id)||!Number.isSafeInteger(result?.horizon))reason='INVALID_EVENT_OR_RESULT';
  else if(duplicateIds.has(result.event_id))reason='DUPLICATE_EVENT_ID';
  else if(!eventsById.has(result.event_id))reason='ORPHAN_RESULT';
  else if(duplicates.has(JSON.stringify([result.event_id,result.horizon])))reason='DUPLICATE_OUTCOME';
  else if(result.horizon!==5)reason='INVALID_HORIZON';
  else {
   const event=eventsById.get(result.event_id);
   const signalDate=kind==='bb'?event.signal_date:event.signal_trade_date;
   if(!date(signalDate)||!date(result.evaluated_trade_date)||result.evaluated_trade_date<=signalDate)reason='INVALID_OUTCOME_DATE';
   else if(!positive(Number(event.entry_price))||!positive(Number(result.future_price))||
     result.return_percent===null||result.return_percent===undefined||!Number.isFinite(Number(result.return_percent)))reason='INVALID_RETURN';
   else reason='LINKED_UNVERIFIED';
  }
  counts[reason]++;
  findings.push({eventId:result?.event_id??null,horizon:result?.horizon??null,reason});
 }
 return {researchOnly:true,productionEligible:false,forwardEvidenceEligible:false,
  totalEvents:events.length,totalResults:results.length,counts,findings,
  nextAction:'Validate source rights, immutable timestamps, five actual TSE sessions and independent outcome prices before considering research evidence.'};
}
