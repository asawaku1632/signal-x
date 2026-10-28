// Research-only evidence ledger, with explicit rejection reasons and no database writes.
import {verifyMarketBreadthResearchPair} from './marketBreadthEvidenceGate.mjs';
const key=r=>[r?.tradeDate,r?.code,r?.signalGeneratedAt].join('|');
export function auditMarketBreadthEvidence(rows, verifyEvidence){
 if(typeof verifyEvidence!=='function')throw new Error('EVIDENCE_RESOLVER_REQUIRED');
 const accepted=[],rejected=[],seen=new Set(),duplicateKeys=new Set();
 const input=Array.isArray(rows)?rows:[];
 for(const row of input){const k=key(row);if(seen.has(k))duplicateKeys.add(k);seen.add(k);}
 for(const row of input){
  const k=key(row);
  if(duplicateKeys.has(k)){rejected.push({tradeDate:row?.tradeDate??null,code:row?.code??null,reason:'DUPLICATE_RESEARCH_PAIR'});continue;}
  let evidence;
  try{evidence=verifyEvidence(row);}catch{rejected.push({tradeDate:row?.tradeDate??null,code:row?.code??null,reason:'EVIDENCE_LOOKUP_FAILED'});continue;}
  const result=verifyMarketBreadthResearchPair(row,evidence);
  if(result.eligible)accepted.push(result);
  else rejected.push({tradeDate:row?.tradeDate??null,code:row?.code??null,reason:result.reason});
 }
 const counts={};for(const r of rejected)counts[r.reason]=(counts[r.reason]??0)+1;
 return {researchOnly:true,productionEligible:false,accepted,rejected,rejectionCounts:counts,
  total:input.length,acceptedCount:accepted.length,rejectedCount:rejected.length};
}
