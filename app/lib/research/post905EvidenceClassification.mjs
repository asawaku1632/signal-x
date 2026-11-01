/** Offline classification of historical research records. Never reconstruct capture times. */
const iso=s=>typeof s==='string'&&/^20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(s)&&Number.isFinite(Date.parse(s))?Date.parse(s):null;
export function classifyHistoricalEvidence(record,{code,date}={}){
 const reasons=[];
 if(!record||typeof record!=='object'||Array.isArray(record))reasons.push('INVALID_RECORD');
 if(record?.code!==code||record?.trade_date!==date)reasons.push('SCOPE_MISMATCH');
 const source=record?.source_name;
 if(typeof source!=='string'||!source.trim())reasons.push('SOURCE_UNVERIFIED');
 const bar=iso(record?.source_bar_at),received=iso(record?.scan_received_at),captured=iso(record?.captured_at);
 const cutoff=iso(date+'T09:05:00+09:00');
 if(bar===null||received===null||captured===null)reasons.push('TIMESTAMP_MISSING_OR_INVALID');
 else if(!(bar<=received&&received<=captured&&captured<=cutoff))reasons.push('NOT_AVAILABLE_BY_0905');
 if(record?.capture_status!=='ACCEPTED')reasons.push('CAPTURE_STATUS_NOT_ACCEPTED');
 // An existing DB row does not prove independently replayable signal inputs.
 reasons.push('NO_INDEPENDENT_SIGNAL_REPLAY');
 return {version:'post905_historical_evidence_classification_v1',code:code??null,date:date??null,
  timestampsWithin905:!reasons.includes('TIMESTAMP_MISSING_OR_INVALID')&&!reasons.includes('NOT_AVAILABLE_BY_0905'),
  sourcePresent:!reasons.includes('SOURCE_UNVERIFIED'),reasons,
  historicalOnly:true,independentCaptureVerified:false,
  verifiedTradingEdge:false,eligibleForNotifications:false,eligibleForProduction:false};
}
