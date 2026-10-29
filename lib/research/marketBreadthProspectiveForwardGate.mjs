// Shadow-only preflight. Passing internal consistency is not external verification.
import {validateMarketBreadthProspectiveSignalBatch} from './marketBreadthProspectiveSignalBatch.mjs';
export function preflightMarketBreadthProspectiveForward(entries){
 const batch=validateMarketBreadthProspectiveSignalBatch(entries);
 const candidates=batch.accepted.map(({index,record,sourceHash})=>({
  index,signalRecordId:record.signalRecordId,sourceRecordId:record.sourceRecordId,sourceHash,
  tradeDate:record.tradeDate,code:record.code,payloadHash:record.payloadHash,
  status:'AWAITING_INDEPENDENT_FORWARD_EVIDENCE',forwardEligible:false,
  missing:['INDEPENDENT_SOURCE_ATTESTATION','VERIFIED_PROVIDER_LICENSE','INDEPENDENT_FIVE_EXCHANGE_SESSION_OUTCOME']
 }));
 return {researchOnly:true,productionEligible:false,notificationEligible:false,forwardVerifiedCount:0,
  submittedCount:batch.submittedCount,preflightCandidateCount:candidates.length,
  rejectedCount:batch.rejectedCount,candidates,rejected:batch.rejected};
}
