/** Offline audit of SAVED daily-result provenance relationships.
 * Does not authenticate score timing, provider/license or price execution.
 */
const date=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+"T00:00:00Z"))&&new Date(x+"T00:00:00Z").toISOString().slice(0,10)===x;
const finite=x=>typeof x==="number"&&Number.isFinite(x);
export function auditSavedOutcomeRelationships(rows,{priceTolerance=0.000001}={}){
 if(!Array.isArray(rows)||!finite(priceTolerance)||priceTolerance<0)throw Error("INVALID_OUTCOME_AUDIT_INPUT");
 const counts={total:rows.length,consistentOutcomeLink:0,missingReference:0,invalid:0,nonfutureSourceDate:0,priceMismatch:0,duplicate:0};
 const seen=new Set();
 for(const r of rows){
  if(!r||!date(r.date)||typeof r.code!=="string"||!/^(?:\d{4}|\d{3}[A-Z])$/.test(r.code)||
     !finite(r.nextPrice)||r.nextPrice<=0){counts.invalid++;continue;}
  const key=r.date+"|"+r.code;
  if(seen.has(key)){counts.duplicate++;continue;}seen.add(key);
  if(!r.sourceDate||r.sourcePrice==null){counts.missingReference++;continue;}
  if(!date(r.sourceDate)||!finite(r.sourcePrice)||r.sourcePrice<=0){counts.invalid++;continue;}
  if(r.sourceDate<=r.date){counts.nonfutureSourceDate++;continue;}
  if(Math.abs(r.sourcePrice-r.nextPrice)>priceTolerance){counts.priceMismatch++;continue;}
  counts.consistentOutcomeLink++;
 }
 return {version:"SAVED_OUTCOME_RELATION_AUDIT_V1",counts,priceTolerance,
  independentlyVerifiedDecisionTime:false,independentlyVerifiedProvider:false,
  acceptedForSignals:0,shadowOnly:true,
  warning:"Consistent linked stored values do NOT prove decision-time score provenance, provider rights, next-session close, or executable returns."};
}
