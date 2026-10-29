// Research-only signed evidence review. A valid signature does not establish external authority.
import {bindMarketBreadthSignedEvidence} from './marketBreadthSignedEvidenceBinding.mjs';
export function reviewMarketBreadthSignedEvidenceBatch(entries,{trustedPublicKeyPem,trustedKeyFingerprint}={}){
 if(!Array.isArray(entries)||entries.length>100000)throw new TypeError('INVALID_SIGNED_EVIDENCE_BATCH');
 const reviewed=[],rejected=[],bySignal=new Map(),byOutcome=new Map();
 for(let index=0;index<entries.length;index++){
  const entry=entries[index];
  const result=bindMarketBreadthSignedEvidence({...entry,trustedPublicKeyPem,trustedKeyFingerprint});
  if(!result.bound){rejected.push({index,reason:result.reason});continue}
  reviewed.push({index,...result});
  for(const [map,id] of [[bySignal,result.signalRecordId],[byOutcome,result.outcomeRecordId]]){const owners=map.get(id)??[];owners.push(index);map.set(id,owners)}
 }
 const duplicate=new Set();
 for(const owners of [...bySignal.values(),...byOutcome.values()])if(owners.length>1)for(const index of owners)duplicate.add(index);
 const accepted=reviewed.filter(x=>!duplicate.has(x.index));
 for(const row of reviewed)if(duplicate.has(row.index))rejected.push({index:row.index,reason:'DUPLICATE_SIGNED_EVIDENCE_ID'});
 rejected.sort((a,b)=>a.index-b.index);
 return {researchOnly:true,productionEligible:false,notificationEligible:false,externallyTrustedCount:0,signatureBoundCount:accepted.length,rejectedCount:rejected.length,accepted,rejected};
}
