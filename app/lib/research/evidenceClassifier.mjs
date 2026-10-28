/** Offline evidence classifier: caller supplied immutable source rows only.
 * No database connection, export, or self-certification. */
const date=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&
 !Number.isNaN(Date.parse(x+"T00:00:00Z"))&&
 new Date(x+"T00:00:00Z").toISOString().slice(0,10)===x;
const instant=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(x)&&Number.isFinite(Date.parse(x));
const money=x=>typeof x==="number"&&Number.isFinite(x)&&x>0;
const code=x=>typeof x==="string"&&/^(?:\d{4}|\d{3}[A-Z])$/.test(x);
export function classifyResearchEvidence(rows,{priceTolerance=0.000001}={}){
 if(!Array.isArray(rows)||!Number.isFinite(priceTolerance)||priceTolerance<0)throw Error("INVALID_EVIDENCE_INPUT");
 const summary={total:rows.length,verified:0,missingPrior:0,latePrior:0,missingOutcome:0,wrongOutcomeDate:0,priceMismatch:0,invalid:0};
 const results=[],seen=new Set();
 for(const row of rows){
  let reason="verified";
  if(!row||!date(row.date)||!code(row.code)||!money(row.price)||!money(row.nextPrice)||!money(row.sourcePrice))
    reason="invalid";
  else if(seen.has(row.date+"|"+row.code))reason="invalid";
  else if(!date(row.priorDate)||!instant(row.priorAvailableAt)||row.priorEvidenceVerified!==true)reason="missingPrior";
  else if(row.priorDate>=row.date||Date.parse(row.priorAvailableAt)>=Date.parse(row.date+"T00:00:00+09:00"))reason="latePrior";
  else if(row.outcomeProvenanceVerified!==true||!date(row.sourceDate))reason="missingOutcome";
  else if(row.sourceDate<=row.date)reason="wrongOutcomeDate";
  else if(Math.abs(row.nextPrice-row.sourcePrice)>priceTolerance)reason="priceMismatch";
  if(row&&date(row.date)&&code(row.code))seen.add(row.date+"|"+row.code);
  summary[reason]++;
  results.push({date:row?.date??null,code:row?.code??null,status:reason==="verified"?"EVIDENCE_ASSERTED":"REJECTED",reason});
 }
 return {version:"RESEARCH_EVIDENCE_CLASSIFIER_V1",summary,results,
   independentlyVerified:false,warning:"Input assertions do not independently prove data provenance, source license, or price timestamp. No live usage."};
}
