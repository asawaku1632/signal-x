// Research-only capture-envelope validator. No I/O and no inference of historical generation times.
const timestamp=s=>{
 if(typeof s!=='string')return NaN;
 const m=/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(s);
 if(!m||Number(m[2])>23||Number(m[3])>59||Number(m[4])>59)return NaN;
 const midnight=Date.parse(m[1]+'T00:00:00Z');
 if(!Number.isFinite(midnight)||new Date(midnight).toISOString().slice(0,10)!==m[1])return NaN;
 if(m[5]!=='Z'&&(Number(m[5].slice(1,3))>23||Number(m[5].slice(4))>59))return NaN;
 const parsed=Date.parse(s);return Number.isFinite(parsed)?parsed:NaN;
};
const dayJst=t=>new Date(t+9*3600000).toISOString().slice(0,10);
const id=s=>typeof s==='string'&&/^[A-Za-z0-9:_-]{8,128}$/.test(s);
export function validateMarketBreadthCaptureEnvelope(e){
 const fail=reason=>({accepted:false,reason,researchOnly:true,productionEligible:false});
 if(!e||typeof e!=='object'||Array.isArray(e)||e.schemaVersion!=='market-breadth-capture-envelope-v1')return fail('INVALID_ENVELOPE');
 if(!id(e.signalRecordId)||!id(e.snapshotRecordId)||!id(e.sourceRecordId)||new Set([e.signalRecordId,e.snapshotRecordId,e.sourceRecordId]).size!==3)return fail('SOURCE_IDS_MISSING');
 if(!/^(?:[0-9]{4}|[0-9]{3}[A-Z])$/.test(e.code??''))return fail('INVALID_SECURITY_CODE');
 const observed=timestamp(e.sourceObservedAt),bar=timestamp(e.barEndAt),generated=timestamp(e.signalGeneratedAt),snapshot=timestamp(e.snapshotUpdatedAt),recorded=timestamp(e.recordedAt);
 if(![observed,bar,generated,snapshot,recorded].every(Number.isFinite))return fail('TIMESTAMPS_MISSING');
 if(!(bar<=observed&&observed<=generated&&generated<=snapshot&&snapshot<=recorded))return fail('AS_OF_CHRONOLOGY_INVALID');
 if(e.tradeDate!==dayJst(generated)||e.tradeDate!==dayJst(bar))return fail('TRADE_DATE_MISMATCH');
 if(e.signalGeneratedAtOrigin!=='INDEPENDENT_GENERATOR_RECORD'||e.originalRecordVerified!==true)return fail('INDEPENDENT_SIGNAL_PROOF_MISSING');
 if(e.providerRightsVerified!==true||typeof e.provider!=='string'||!e.provider.trim()||!id(e.licenseRecordId))return fail('PROVIDER_RIGHTS_UNVERIFIED');
 if(typeof e.snapshotHash!=='string'||!/^[a-f0-9]{64}$/i.test(e.snapshotHash))return fail('SNAPSHOT_HASH_MISSING');
 return {accepted:true,researchOnly:true,productionEligible:false,signalRecordId:e.signalRecordId,snapshotRecordId:e.snapshotRecordId,sourceRecordId:e.sourceRecordId,code:e.code,tradeDate:e.tradeDate,signalGeneratedAt:e.signalGeneratedAt,recordedAt:e.recordedAt};
}
