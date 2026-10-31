/**
 * SHADOW-ONLY reconciliation of successive hypothetical MA75 settlement runs.
 * No persistence or production dependency. An immutable completed observation
 * must not silently change to a different price, receipt or result.
 */
export const MA75_SETTLEMENT_REVISION_VERSION = 'ma75_settlement_revision_audit_v1';
const validStatus=x=>typeof x==='string' &&
  (x==='COMPLETED'||x.startsWith('PENDING_')||x.startsWith('QUARANTINED_'));
const describe = settlement => {
  if (!settlement || !Array.isArray(settlement.results)) throw new TypeError('Invalid settlement snapshot');
  const byId=new Map(),duplicateIds=new Set(),problems=[];
  for (const item of settlement.results){
    const id=item?.id;
    if(typeof id!=='string'||!id.includes(':')||!validStatus(item?.status))
      problems.push('INVALID_RESULT_FORMAT');
    else if(byId.has(id)) duplicateIds.add(id);
    else byId.set(id,item);
    if(item?.status==='COMPLETED' &&
       (typeof item.details?.evidenceDigest!=='string'||
        !/^[a-f0-9]{64}$/.test(item.details.evidenceDigest)||
        item.details.id!==id||
        !Number.isFinite(item.details.return5Percent)))
       problems.push('INVALID_COMPLETED_EVIDENCE');
    if(item?.status!=='COMPLETED'&&item?.details!==null)
       problems.push('DETAILS_ON_NONCOMPLETED');
  }
  if (settlement.totalCandidates!==settlement.results.length||
      settlement.completed!==settlement.results.filter(x=>x?.status==='COMPLETED').length||
      settlement.pending!==settlement.results.filter(x=>x?.status?.startsWith('PENDING_')).length||
      settlement.quarantined!==settlement.results.filter(x=>x?.status?.startsWith('QUARANTINED_')).length)
    problems.push('INCONSISTENT_COUNTS');
  return {byId,duplicateIds,problems};
};
export function auditMa75SettlementRevisions(previous, current) {
  if(previous?.version!=='ma75_forward_outcome_v1'||current?.version!=='ma75_forward_outcome_v1'||
    typeof previous.manifestSha256!=='string'||
    previous.manifestSha256!==current.manifestSha256)
    throw new TypeError('Require matching settlement protocol and frozen cohort fingerprint');
  const prev=describe(previous),next=describe(current);
  const issues=[
    ...prev.problems.map(reason=>({id:'PREVIOUS',reason})),
    ...next.problems.map(reason=>({id:'CURRENT',reason})),
    ...[...prev.duplicateIds].map(id=>({id,reason:'PREVIOUS_DUPLICATE'})),
    ...[...next.duplicateIds].map(id=>({id,reason:'CURRENT_DUPLICATE'})),
  ];
  let matured=0,newSignals=0,stableCompleted=0,stillPending=0,manualReview=0;
  for (const [id,earlier] of prev.byId) {
    const later=next.byId.get(id);
    if(!later){issues.push({id,reason:'MISSING_PREVIOUS_SIGNAL'});continue;}
    if(earlier.status==='COMPLETED'){
      if(later.status!=='COMPLETED'||later.details?.evidenceDigest!==earlier.details?.evidenceDigest||
        JSON.stringify(later.details)!==JSON.stringify(earlier.details))
        issues.push({id,reason:'COMPLETED_OUTCOME_CHANGED'});
      else stableCompleted++;
    } else if(earlier.status.startsWith('QUARANTINED_')){
      if (earlier.status!==later.status || JSON.stringify(earlier.details)!==JSON.stringify(later.details)){
        manualReview++;
        issues.push({id,reason:'QUARANTINE_STATUS_CHANGED_WITHOUT_REVIEW'});
      }
    } else if(later.status==='COMPLETED') matured++;
    else if(later.status.startsWith('PENDING_')) stillPending++;
    else {
      manualReview++;
      issues.push({id,reason:'PENDING_TO_QUARANTINE_REQUIRES_REVIEW'});
    }
  }
  for (const [id, item] of next.byId) if(!prev.byId.has(id)) {
    newSignals++;
    // A freshly injected completed historical winner must never bypass a
    // previously observed pending signal and its original capture audit.
    if(item.status==='COMPLETED')
      issues.push({id,reason:'NEW_COMPLETED_SIGNAL_WITHOUT_PRIOR_OBSERVATION'});
  }
  return {
    version:MA75_SETTLEMENT_REVISION_VERSION,manifestSha256:previous.manifestSha256,
    previousCandidates:prev.byId.size,currentCandidates:next.byId.size,
    newlyObservedSignals:newSignals,matured,stableCompleted,stillPending,manualReview,
    validTransition:issues.length===0,issues,
    eligibleForProduction:false,
    independentlyVerifiedForwardReturn:null,
    note:'Reconciliation guards drift only. It cannot certify calendar, provider, source timestamps, corporate actions or real-world predictions.',
  };
}
