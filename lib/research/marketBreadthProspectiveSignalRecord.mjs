// Research-only, deterministic record formatter. No clock, network or database writes.
import {createHash} from 'node:crypto';
const timestamp=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(s)&&Number.isFinite(Date.parse(s));
const validCode=s=>typeof s==='string'&&/^(?:[0-9]{4}|[0-9]{3}[A-Z])$/.test(s);
const safeId=s=>typeof s==='string'&&/^[A-Za-z0-9:_-]{8,128}$/.test(s);
const stable=value=>{
 if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
 if(value&&typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype)return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';
 if(value===null||typeof value==='string'||typeof value==='boolean'||(typeof value==='number'&&Number.isFinite(value)))return JSON.stringify(value);
 throw new TypeError('INVALID_SIGNAL_PAYLOAD');
};
export function formatMarketBreadthProspectiveSignalRecord(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('INVALID_SIGNAL_RECORD');
 const {signalRecordId,sourceRecordId,code,signalGeneratedAt,sourceObservedAt,sourceBarEndAt,provider,licenseRecordId,payload}=input;
 if(!safeId(signalRecordId)||!safeId(sourceRecordId)||signalRecordId===sourceRecordId||!validCode(code))throw new Error('INVALID_SIGNAL_IDENTITY');
 if(![signalGeneratedAt,sourceObservedAt,sourceBarEndAt].every(timestamp))throw new Error('INVALID_SIGNAL_TIMESTAMPS');
 if(!(Date.parse(sourceBarEndAt)<=Date.parse(sourceObservedAt)&&Date.parse(sourceObservedAt)<=Date.parse(signalGeneratedAt)))throw new Error('INVALID_SIGNAL_CHRONOLOGY');
 if(typeof provider!=='string'||!provider.trim()||!safeId(licenseRecordId))throw new Error('PROVIDER_EVIDENCE_REFERENCE_MISSING');
 const day=new Date(Date.parse(signalGeneratedAt)+9*3600000).toISOString().slice(0,10);
 if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new Error('INVALID_SIGNAL_PAYLOAD');
 const canonical=stable(payload);
 const record={schemaVersion:'market-breadth-prospective-signal-v1',researchOnly:true,productionEligible:false,signalRecordId,sourceRecordId,code,tradeDate:day,signalGeneratedAt,sourceObservedAt,sourceBarEndAt,provider,licenseRecordId,payloadHash:createHash('sha256').update(canonical).digest('hex')};
 return Object.freeze(record);
}
