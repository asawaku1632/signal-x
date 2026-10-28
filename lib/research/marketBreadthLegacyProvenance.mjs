// Research-only classifier for legacy records. Never infer historical signal time from insertion time.
const dayJst=value=>{
 if(typeof value!=='string'||!Number.isFinite(Date.parse(value)))return null;
 return new Date(Date.parse(value)+9*3600000).toISOString().slice(0,10);
};
const validDate=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
export function assessLegacySignalProvenance(record,{kind}={}){
 const blocked=reason=>({researchOnly:true,forwardEvidenceEligible:false,reason});
 if(!record||typeof record!=='object'||Array.isArray(record))return blocked('INVALID_RECORD');
 if(kind!=='bb'&&kind!=='technical')return blocked('UNKNOWN_SIGNAL_KIND');
 const signalDate=kind==='bb'?record.signal_date:record.signal_trade_date;
 const captured=kind==='bb'?record.created_at:record.detected_at;
 if(!validDate(signalDate)||dayJst(captured)===null)return blocked('INVALID_SIGNAL_DATE_OR_TIMESTAMP');
 if(dayJst(captured)!==signalDate)return blocked('RETROSPECTIVE_TIMESTAMP_MISMATCH');
 // Matching a timestamp to a trading date is necessary but not sufficient:
 // independent immutable signal provenance is still required.
 return blocked('INDEPENDENT_SIGNAL_PROVENANCE_MISSING');
}
export function summarizeLegacySignalProvenance(records,{kind}={}){
 if(!Array.isArray(records))throw new TypeError('INVALID_LEGACY_RECORDS');
 const reasons={};
 for(const record of records){const {reason}=assessLegacySignalProvenance(record,{kind});reasons[reason]=(reasons[reason]??0)+1}
 return {researchOnly:true,forwardEvidenceEligible:false,total:records.length,reasons};
}
