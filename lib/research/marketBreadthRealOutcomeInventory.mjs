// Pure shadow-only inventory: exclude test fixture codes before reporting real-code outcome coverage.
const validCode=c=>typeof c==='string'&&/^(?:[0-9]{4}|[0-9]{3}[A-Z])$/.test(c);
export function inventoryMarketBreadthRealOutcomes({events=[],results=[]}={}){
 if(!Array.isArray(events)||!Array.isArray(results)||events.length>100000||results.length>100000)throw new TypeError('INVALID_REAL_OUTCOME_INVENTORY');
 const ids=new Map(),invalidEvents=[],duplicates=new Set(),allKeys=new Set(),resultKeys=new Set(),duplicateResultKeys=new Set();
 for(const r of results){if(r&&['BB','TECHNICAL'].includes(r.source)&&Number.isSafeInteger(r.eventId)&&r.eventId>0&&[1,5,10,20].includes(r.horizon)){const k=r.source+':'+r.eventId+':'+r.horizon;if(resultKeys.has(k))duplicateResultKeys.add(k);resultKeys.add(k)}}
 resultKeys.clear();
 for(let i=0;i<events.length;i++){
  const e=events[i],key=e?.source+':'+e?.id;
  if(e&&['BB','TECHNICAL'].includes(e.source)&&Number.isSafeInteger(e.id)&&e.id>0){if(allKeys.has(key))duplicates.add(key);allKeys.add(key)}
  if(!e||!['BB','TECHNICAL'].includes(e.source)||!validCode(e.code)||!Number.isSafeInteger(e.id)||e.id<1||!Number.isFinite(e.entryPrice)||e.entryPrice<=0){invalidEvents.push(i);continue}
  ids.set(key,e);
 }
 const accepted=[],rejected=[];
 for(let i=0;i<results.length;i++){
  const r=results[i],key=r?.source+':'+r?.eventId,e=ids.get(key);
  if(!r||!['BB','TECHNICAL'].includes(r.source)||!Number.isSafeInteger(r.eventId)||r.eventId<1||!Number.isFinite(r.returnPercent)||!Number.isFinite(r.futurePrice)||r.futurePrice<=0||![1,5,10,20].includes(r.horizon)){rejected.push({index:i,reason:'INVALID_RESULT'});continue}
  if(!e||duplicates.has(key)){rejected.push({index:i,reason:'NO_UNIQUE_REAL_CODE_EVENT'});continue}
  const resultKey=key+':'+r.horizon;
  if(duplicateResultKeys.has(resultKey)){rejected.push({index:i,reason:'DUPLICATE_EVENT_HORIZON_RESULT'});continue}
  resultKeys.add(resultKey);
  accepted.push({index:i,source:r.source,code:e.code,eventId:r.eventId,horizon:r.horizon,returnPercent:r.returnPercent});
 }
 const fiveDay=accepted.filter(r=>r.horizon===5);
 return {researchOnly:true,productionEligible:false,notificationEligible:false,aiPromotionAuthorized:false,
  counts:{submittedEvents:events.length,realCodeEvents:[...ids.keys()].filter(k=>!duplicates.has(k)).length,invalidEvents:invalidEvents.length,duplicateEventKeys:duplicates.size,submittedResults:results.length,duplicateResultKeys:duplicateResultKeys.size,matchedRealCodeResults:accepted.length,matchedFiveSessionResults:fiveDay.length,rejectedResults:rejected.length},
  accepted,rejected,independentImprovementVerified:false,
  limitations:['EVENT_AND_RESULT_INPUTS_NOT_EXTERNALLY_AUDITED','FIVE_SESSION_CALENDAR_NOT_VERIFIED','ORIGINAL_SIGNAL_TIME_NOT_VERIFIED','NO_AI_PROMOTION']};
}
