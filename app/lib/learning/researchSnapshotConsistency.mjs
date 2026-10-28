// Research-only: validates declarative consistency, not external authenticity.
// A passing structural check never authorizes production use.
const stamp=v=>typeof v==="string"&&/(?:Z|[+-]\d{2}:\d{2})$/.test(v)&&Number.isFinite(Date.parse(v));
const int=v=>Number.isSafeInteger(v)&&v>=0;
export function inspectSnapshotConsistency(meta, aggregate, rows, evidence) {
 const issues=[];
 if(!meta||typeof meta!=="object"||Array.isArray(meta))return {status:"BLOCKED",issues:["INVALID_ENVELOPE"],independentlyVerified:false};
 if(!aggregate||typeof aggregate!=="object"||Array.isArray(aggregate))issues.push("INVALID_AGGREGATE");
 if(!Array.isArray(rows))issues.push("INVALID_ROWS");
 if(!Array.isArray(evidence))issues.push("INVALID_EVIDENCE");
 const total=Number(aggregate?.total);
 if(!int(total)||!int(meta.reportedTotal)||total!==meta.reportedTotal)issues.push("TOTAL_MISMATCH");
 if(!int(meta.rowsRead)||!Array.isArray(rows)||meta.rowsRead!==rows.length)issues.push("ROWS_READ_MISMATCH");
 if(meta.isComplete===true&&int(meta.reportedTotal)&&int(meta.rowsRead)&&meta.rowsRead!==meta.reportedTotal)issues.push("FALSE_COMPLETENESS_CLAIM");
 if(meta.isComplete===true&&Array.isArray(rows)&&int(meta.reportedTotal)&&rows.length!==meta.reportedTotal)issues.push("INCOMPLETE_FULL_READ");
 if(!stamp(meta.snapshotAt)||!stamp(meta.queryStartedAt)||!stamp(meta.queryFinishedAt))issues.push("INVALID_TIME_ENVELOPE");
 else {
  const snap=Date.parse(meta.snapshotAt),start=Date.parse(meta.queryStartedAt),end=Date.parse(meta.queryFinishedAt);
  if(end<start)issues.push("REVERSED_QUERY_WINDOW");
  if(snap>end)issues.push("SNAPSHOT_AFTER_QUERY");
 }
 if(!Array.isArray(rows)||!Array.isArray(evidence)||rows.length!==evidence.length)issues.push("EVIDENCE_COUNT_NOT_ALIGNED");
 if(Array.isArray(rows)){
  const seen=new Set();
  for(const r of rows.slice(0,1000)){
    if(!r||typeof r.trade_date!=="string"||typeof r.code!=="string"){issues.push("INVALID_OBSERVATION_KEY");continue}
    const k=r.trade_date+"|"+r.code;
    if(seen.has(k))issues.push("DUPLICATE_OBSERVATION_KEY");
    seen.add(k);
  }
  if(rows.length>1000)issues.push("BOUNDED_REVIEW_ONLY");
 }
 if(meta.sourceVerified!==true||meta.licenseVerified!==true)issues.push("SOURCE_OR_LICENSE_UNVERIFIED");
 // Source identifiers and digest strings alone do not prove data authenticity.
 issues.push("INDEPENDENT_ATTESTATION_UNAVAILABLE");
 return {status:"BLOCKED",issues:[...new Set(issues)].sort(),independentlyVerified:false,productionEligible:false};
}
