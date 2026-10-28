import { inspectStoredGapMatrix } from "./researchObservedGapMatrix.mjs";
// Research-only reconciliation of observed rows and independent review metadata.
// An externally claimed attestation cannot be inferred from stored performance numbers.
const valid=(s)=>typeof s==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(s);
export function reconcileReadOnlyEvidence(rows, evidence, {limit=1000}={}){
 if(!Array.isArray(rows)||!Array.isArray(evidence))return {status:"BLOCKED",reasonCounts:{INVALID_INPUT:1},checked:0};
 const cap=Number.isSafeInteger(limit)&&limit>0?Math.min(limit,1000):1000;
 const base=inspectStoredGapMatrix(rows.slice(0,cap),{limit:cap});
 const proof=new Map(),counts={...base.reasonCounts};
 for(const e of evidence.slice(0,cap)){
  if(!e||!valid(e.trade_date)||typeof e.code!=="string"){counts.INVALID_EVIDENCE=(counts.INVALID_EVIDENCE||0)+1;continue}
  const k=e.trade_date+"|"+e.code;
  if(proof.has(k))counts.DUPLICATE_EVIDENCE=(counts.DUPLICATE_EVIDENCE||0)+1;
  else proof.set(k,e);
 }
 const seen=new Set();let matched=0;
 for(const r of rows.slice(0,cap)){
  if(!r||!valid(r.trade_date)||typeof r.code!=="string")continue;
  const k=r.trade_date+"|"+r.code;
  seen.add(k);
  if(!proof.has(k)){counts.MISSING_INDEPENDENT_REVIEW=(counts.MISSING_INDEPENDENT_REVIEW||0)+1;continue}
  matched++;const e=proof.get(k);
  if(e.independent_verified!==true)counts.UNVERIFIED_INDEPENDENT_REVIEW=(counts.UNVERIFIED_INDEPENDENT_REVIEW||0)+1;
  if(e.license_verified!==true)counts.UNVERIFIED_LICENSE=(counts.UNVERIFIED_LICENSE||0)+1;
  if(e.baseline_paired!==true||e.shadow_paired!==true)counts.INCOMPLETE_PAIR=(counts.INCOMPLETE_PAIR||0)+1;
  if(e.forward_holdout_verified!==true)counts.UNVERIFIED_FORWARD_HOLDOUT=(counts.UNVERIFIED_FORWARD_HOLDOUT||0)+1;
  // The truth of these external assertions is not established by this adapter.
  counts.EXTERNAL_ATTESTATION_NOT_ESTABLISHED=(counts.EXTERNAL_ATTESTATION_NOT_ESTABLISHED||0)+1;
 }
 for(const k of proof.keys())if(!seen.has(k))counts.ORPHAN_EVIDENCE=(counts.ORPHAN_EVIDENCE||0)+1;
 const truncated=rows.length>cap||evidence.length>cap;
 if(truncated)counts.TRUNCATED_REVIEW=1;
 return {status:"BLOCKED",eligible:false,checked:Math.min(rows.length,cap),matched,truncated,reasonCounts:counts,dimensions:base.dimensions};
}
