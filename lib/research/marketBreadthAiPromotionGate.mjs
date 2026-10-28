// Shadow-only candidate classification. Never promotes models, notifications or live decisions.
import {buildMarketBreadthEvidenceAuditReport} from './marketBreadthEvidenceAuditReport.mjs';
export function assessMarketBreadthAiPromotionCandidates(input={}){
 const audit=buildMarketBreadthEvidenceAuditReport(input);
 const matched=new Set(audit.matchedSignalIds);
 const candidates=[];
 const seen=new Set();
 for(const entry of input.prospectiveEntries??[]){
  const id=entry?.signal?.signalRecordId;
  if(typeof id!=='string'||seen.has(id))continue;
  seen.add(id);
  candidates.push({signalRecordId:id,classification:matched.has(id)?'SIGNED_INTERNAL_MATCH_UNVERIFIED':'EVIDENCE_INCOMPLETE',eligibleForAiPromotion:false,eligibleForNotification:false,
   missing:matched.has(id)?['INDEPENDENT_AUDITOR_AUTHORITY','LICENSE_VERIFICATION','AUDITED_FIVE_SESSION_OUTCOME']:['MATCHED_SIGNED_EVIDENCE','INDEPENDENT_AUDITOR_AUTHORITY','LICENSE_VERIFICATION','AUDITED_FIVE_SESSION_OUTCOME']});
 }
 candidates.sort((a,b)=>a.signalRecordId.localeCompare(b.signalRecordId));
 return {researchOnly:true,productionEligible:false,notificationEligible:false,aiPromotionAuthorized:false,eligibleCount:0,audit,candidates};
}
