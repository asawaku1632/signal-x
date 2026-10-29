/** Offline evidence contract: timestamp strings in legacy tables are not as-of proof. */
const strictUtc = value => {
 if(typeof value!=="string"||!/^\\d{4}-\\d\\d-\\d\\dT\\d\\d:\\d\\d:\\d\\d(?:\\.\\d{1,3})?Z$/.test(value)||!Number.isFinite(Date.parse(value)))return false;
 const y=Number(value.slice(0,4)),m=Number(value.slice(5,7)),d=Number(value.slice(8,10));
 const h=Number(value.slice(11,13)),min=Number(value.slice(14,16)),sec=Number(value.slice(17,19));
 return y>=100&&m>=1&&m<=12&&d>=1&&d<=new Date(Date.UTC(y,m,0)).getUTCDate()&&h<=23&&min<=59&&sec<=59;
};
export function auditPredecisionEvidence(rows,{cutoffUtc}={}){
 if(!Array.isArray(rows))throw Error("INVALID_EVIDENCE_ROWS");
 if(!strictUtc(cutoffUtc))throw Error("INVALID_CUTOFF_UTC");
 const cutoff=Date.parse(cutoffUtc);
 const reasons={missingProvenance:0,invalidTimestamp:0,afterCutoff:0,missingSourceRights:0};
 let eligible=0;
 for(const row of rows){
  if(!row||row.sourceVerified!==true||row.scoreVersionVerified!==true){reasons.missingProvenance++;continue;}
  if(!strictUtc(row.featureGeneratedAtUtc)||!strictUtc(row.quoteObservedAtUtc)||!strictUtc(row.barEndedAtUtc)){reasons.invalidTimestamp++;continue;}
  const timestamps=[row.featureGeneratedAtUtc,row.quoteObservedAtUtc,row.barEndedAtUtc].map(Date.parse);
  if(timestamps.some(t=>t>cutoff)||timestamps[2]>timestamps[1]){reasons.afterCutoff++;continue;}
  if(row.retentionAndResearchAllowed!==true){reasons.missingSourceRights++;continue;}
  eligible++;
 }
 return {received:rows.length,eligible,rejected:rows.length-eligible,reasons,asOfCutoffUtc:cutoffUtc,
  independentlyValidated:false,readyForTraining:false,readyForTrading:false,
  warning:"Caller-attested timestamps and rights do not independently authenticate historical source data; no trading or training authorization."};
}
