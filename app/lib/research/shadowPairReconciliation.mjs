/** Offline reconciliation of pre-decision score snapshots to later paired outcomes. */
export function reconcileShadowPairs(snapshots,outcomes){
 if(!Array.isArray(snapshots)||!Array.isArray(outcomes))throw Error("INVALID_SHADOW_PAIRS");
 const date=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+"T00:00:00Z"))&&new Date(x+"T00:00:00Z").toISOString().slice(0,10)===x;
 const validInstant=x=>typeof x==="string"&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(x)&&Number.isFinite(Date.parse(x));
 const byKey=new Map(),blocked={invalidSnapshot:0,lateSnapshot:0,duplicateSnapshot:0,missingSnapshot:0,invalidOutcome:0,duplicateOutcome:0};
 for(const s of snapshots){
  if(!date(s?.tradeDate)||typeof s.code!=="string"||!Number.isFinite(s.baselineScore)||!Number.isFinite(s.candidateScore)||!validInstant(s.recordedAt)){blocked.invalidSnapshot++;continue;}
  const key=s.tradeDate+"|"+s.code;
  if(byKey.has(key)){blocked.duplicateSnapshot++;byKey.set(key,null);continue;}
  if(Date.parse(s.recordedAt)>=Date.parse(s.tradeDate+"T09:05:00+09:00")){blocked.lateSnapshot++;byKey.set(key,null);continue;}
  byKey.set(key,s);
 }
 const seen=new Set(),pairs=[];
 for(const o of outcomes){
  if(!date(o?.tradeDate)||!date(o.outcomeDate)||o.outcomeDate<=o.tradeDate||typeof o.code!=="string"||!Number.isFinite(o.realizedReturn)||!validInstant(o.outcomeRecordedAt)||Date.parse(o.outcomeRecordedAt)<Date.parse(o.outcomeDate+"T00:00:00+09:00")){blocked.invalidOutcome++;continue;}
  const key=o.tradeDate+"|"+o.code;
  if(seen.has(key)){blocked.duplicateOutcome++;continue;}seen.add(key);
  const s=byKey.get(key);
  if(!s){blocked.missingSnapshot++;continue;}
  pairs.push({tradeDate:o.tradeDate,code:o.code,baselineScore:s.baselineScore,candidateScore:s.candidateScore,realizedReturn:o.realizedReturn});
 }
 return {pairs,blocked,independentlyAuthenticated:false,approvedForTraining:false,approvedForTrading:false,
 warning:"This is a chronology and matching contract only; score provenance, source license, and immutable independent timestamps are not attested."};
}
