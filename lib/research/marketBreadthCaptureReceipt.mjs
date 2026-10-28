// Pure research-only receipt builder. Never upgrades a mutable display snapshot into a prediction.
import {createHash} from 'node:crypto';
import {validateMarketBreadthCaptureEnvelope} from './marketBreadthCaptureEnvelope.mjs';
const canonical=value=>{
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&typeof value==='object'){
  const keys=Object.keys(value).sort();
  return '{'+keys.map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
 }
 if(value===null||typeof value==='string'||typeof value==='boolean'||(typeof value==='number'&&Number.isFinite(value)))return JSON.stringify(value);
 throw new TypeError('NON_CANONICAL_EVIDENCE_VALUE');
};
export function buildMarketBreadthCaptureReceipt(envelope,{sourceRecord,snapshotRecord}={}){
 const fail=reason=>({accepted:false,reason,researchOnly:true,productionEligible:false});
 if(!sourceRecord||!snapshotRecord||typeof sourceRecord!=='object'||typeof snapshotRecord!=='object'||Array.isArray(sourceRecord)||Array.isArray(snapshotRecord))return fail('IMMUTABLE_SOURCE_RECORDS_MISSING');
 let fingerprint;
 try{fingerprint=createHash('sha256').update(canonical(snapshotRecord)).digest('hex')}catch{return fail('SNAPSHOT_CANONICALIZATION_FAILED')}
 if(envelope?.snapshotHash!==fingerprint)return fail('SNAPSHOT_HASH_MISMATCH');
 if(sourceRecord.recordId!==envelope.sourceRecordId||snapshotRecord.recordId!==envelope.snapshotRecordId)return fail('SOURCE_RECORD_BINDING_MISMATCH');
 if(sourceRecord.observedAt!==envelope.sourceObservedAt||sourceRecord.barEndAt!==envelope.barEndAt||snapshotRecord.updatedAt!==envelope.snapshotUpdatedAt)return fail('SOURCE_TIME_BINDING_MISMATCH');
 if(sourceRecord.code!==envelope.code||!Array.isArray(snapshotRecord.stocks)||!snapshotRecord.stocks.some(stock=>stock?.code===envelope.code))return fail('SOURCE_SECURITY_BINDING_MISMATCH');
 const verdict=validateMarketBreadthCaptureEnvelope(envelope);
 if(!verdict.accepted)return verdict;
 return {...verdict,snapshotHash:fingerprint,receiptVersion:'market-breadth-capture-receipt-v1',sourceRecordVerifiedExternally:true};
}
export function hashMarketBreadthSnapshotRecord(snapshotRecord){
 return createHash('sha256').update(canonical(snapshotRecord)).digest('hex');
}
