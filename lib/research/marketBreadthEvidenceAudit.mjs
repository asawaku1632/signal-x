// Research-only evidence ledger, with explicit rejection reasons and no database writes.
import {verifyMarketBreadthResearchPair} from './marketBreadthEvidenceGate.mjs';
// One security per trading day per research cohort; ambiguous multiple signals are quarantined.
const key=r=>JSON.stringify([r?.tradeDate??null,r?.code??null]);
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
 // A source signal/outcome record cannot validate two different research pairs.
 const sourceOwners=new Map(),reused=new Set();
 for(const item of accepted){
  for(const field of ['signalRecordId','outcomeRecordId']){
   const token=field+':'+item[field];
   if(sourceOwners.has(token)){
    reused.add(sourceOwners.get(token));reused.add(item);
   }else sourceOwners.set(token,item);
  }
 }
 if(reused.size){
  for(const item of reused){
   const i=accepted.indexOf(item);if(i>=0)accepted.splice(i,1);
   rejected.push({tradeDate:item.tradeDate,code:item.code,reason:'REUSED_SOURCE_EVIDENCE'});
  }
 }
 const counts={};for(const r of rejected)counts[r.reason]=(counts[r.reason]??0)+1;
 const provenance=accepted.map(r=>({tradeDate:r.tradeDate,code:r.code,
  signalRecordId:r.signalRecordId,marketRecordId:r.marketRecordId,outcomeRecordId:r.outcomeRecordId,
  marketProvider:r.marketProvider,outcomeProvider:r.outcomeProvider,ruleVersion:r.ruleVersion}));
 return {researchOnly:true,productionEligible:false,accepted,rejected,rejectionCounts:counts,
  total:input.length,acceptedCount:accepted.length,rejectedCount:rejected.length,
  provenance};
}
