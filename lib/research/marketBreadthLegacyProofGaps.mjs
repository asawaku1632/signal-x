// Diagnostic-only proof-gap ledger. Never accepts self-asserted flags as external verification.
import {partitionMarketBreadthLegacyRecords} from './marketBreadthLegacyRecordPartition.mjs';
export function diagnoseMarketBreadthLegacyProofGaps({bbEvents=[],technicalEvents=[]}={}){
 const partition=partitionMarketBreadthLegacyRecords({bbEvents,technicalEvents});
 const gaps=[];
 for(const item of partition.descriptive){
  gaps.push({kind:item.kind,id:item.id,code:item.code,tradeDate:item.tradeDate,classification:'DESCRIPTIVE_ONLY',missing:[
   'INDEPENDENT_SIGNAL_GENERATED_AT',
   'IMMUTABLE_SOURCE_RECORD_AND_HASH',
   'LICENSED_PROVIDER_RIGHTS_EVIDENCE',
   'SOURCE_BAR_END_AT',
   'INDEPENDENT_FIVE_SESSION_OUTCOME'
  ]});
 }
 for(const item of partition.quarantined){
  gaps.push({kind:item.kind,id:item.id,code:item.code,tradeDate:item.tradeDate,classification:'QUARANTINED',missing:[item.reason]});
 }
 const missingCounts={};
 for(const gap of gaps)for(const reason of gap.missing)missingCounts[reason]=(missingCounts[reason]??0)+1;
 return {researchOnly:true,productionEligible:false,notificationEligible:false,proofStatus:'UNVERIFIED_LEGACY_RECORDS',counts:partition.counts,missingCounts,gaps};
}
