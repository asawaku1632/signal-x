// Offline research-only batch verifier; no persistence and no source-rights attestation.
import {formatMarketBreadthProspectiveSignalRecord} from './marketBreadthProspectiveSignalRecord.mjs';
export function validateMarketBreadthProspectiveSignalBatch(entries){
 if(!Array.isArray(entries)||entries.length>100000)throw new TypeError('INVALID_PROSPECTIVE_BATCH');
 const accepted=[],rejected=[],bySignal=new Map(),bySource=new Map();
 for(let index=0;index<entries.length;index++){
  const entry=entries[index];
  try{
   if(!entry||typeof entry!=='object'||Array.isArray(entry))throw new Error('INVALID_SIGNAL_RECORD');
   if(!entry.sourceRecord||typeof entry.sourceRecord!=='object'||Array.isArray(entry.sourceRecord))throw new Error('SOURCE_RECORD_MISSING');
   const source=entry.sourceRecord;
   if(source.recordId!==entry.signal?.sourceRecordId||source.code!==entry.signal?.code||source.observedAt!==entry.signal?.sourceObservedAt||source.barEndAt!==entry.signal?.sourceBarEndAt)throw new Error('SOURCE_RECORD_BINDING_MISMATCH');
   const record=formatMarketBreadthProspectiveSignalRecord(entry.signal);
   accepted.push({index,record});
   const owners=bySignal.get(record.signalRecordId)??[];owners.push(index);bySignal.set(record.signalRecordId,owners);
   const sourceKey=JSON.stringify([record.sourceRecordId,record.code]);
   const sources=bySource.get(sourceKey)??[];sources.push(index);bySource.set(sourceKey,sources);
  }catch(error){rejected.push({index,reason:error instanceof Error?error.message:'INVALID_SIGNAL_RECORD'})}
 }
 const tainted=new Set();
 for(const owners of bySignal.values())if(owners.length>1)for(const index of owners)tainted.add(index);
 const clean=accepted.filter(x=>!tainted.has(x.index));
 for(const item of accepted)if(tainted.has(item.index))rejected.push({index:item.index,reason:'DUPLICATE_SIGNAL_RECORD_ID'});
 return {researchOnly:true,productionEligible:false,notificationEligible:false,submittedCount:entries.length,acceptedCount:clean.length,rejectedCount:rejected.length,accepted:clean,rejected:rejected.sort((a,b)=>a.index-b.index)};
}
