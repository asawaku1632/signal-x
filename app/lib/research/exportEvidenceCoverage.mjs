/** Research-only coverage of exported observations.
 * Describes input evidence availability, not independent verification or alpha.
 */
const own=(x,k)=>x&&typeof x==="object"&&!Array.isArray(x)&&Object.hasOwn(x,k);
export function summarizeExportEvidence(rows){
 if(!Array.isArray(rows))throw Error("INVALID_EXPORT_EVIDENCE_INPUT");
 const coverage={rows:rows.length,withPriorScore:0,withPriorSavedDate:0,
  withPricePair:0,withSourcePrice:0,withSourceDate:0,
  withPriorAsOfTimestamp:0,priorEvidenceAsserted:0,outcomeEvidenceAsserted:0,
  rowsWithAllRawFields:0,independentlyAuthenticated:0};
 for(const r of rows){
  const n=x=>typeof x==="number"&&Number.isFinite(x)&&x>0;
  const prior=typeof r?.priorScore==="number"&&Number.isFinite(r.priorScore);
  const priorDate=typeof r?.priorDate==="string";
  const pair=n(r?.price)&&n(r?.nextPrice);
  const src=n(r?.sourcePrice),srcDate=typeof r?.sourceDate==="string";
  const asOf=typeof r?.priorAvailableAt==="string";
  coverage.withPriorScore+=Number(prior);
  coverage.withPriorSavedDate+=Number(priorDate);
  coverage.withPricePair+=Number(pair);
  coverage.withSourcePrice+=Number(src);
  coverage.withSourceDate+=Number(srcDate);
  coverage.withPriorAsOfTimestamp+=Number(asOf);
  coverage.priorEvidenceAsserted+=Number(r?.priorEvidenceVerified===true);
  coverage.outcomeEvidenceAsserted+=Number(r?.outcomeProvenanceVerified===true);
  coverage.rowsWithAllRawFields+=Number(prior&&priorDate&&pair&&src&&srcDate&&asOf);
 }
 return {version:"EXPORT_EVIDENCE_COVERAGE_V1",coverage,
  independentAuthenticationPerformed:false,
  warning:"Counts reflect only supplied fields and assertions. No provider, licensing, as-of, or market price authentication."};
}
