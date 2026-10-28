import {auditMarketIndexResearchRows} from './marketBreadthIndexAudit.mjs';
import {compareBreadthForward} from './marketBreadthForward.mjs';
// Explicit preflight: no claims of validated edge when either cohort is empty.
export function marketBreadthResearchReadiness({indexRows=[],snapshots=[],observations=[]}={}) {
  const audit=auditMarketIndexResearchRows(indexRows);
  const comparison=compareBreadthForward(snapshots,observations);
  const marketObservations=comparison.divergence.observations+comparison.other.observations;
  const reasons=[];
  if(audit.counts.providerApprovalRequired>0)reasons.push('INDEX_PROVIDER_APPROVAL_PENDING');
  if(!Array.isArray(snapshots)||snapshots.length===0)reasons.push('NO_BREADTH_SNAPSHOTS');
  if(marketObservations===0)reasons.push('NO_VERIFIED_AS_OF_FIVE_DAY_PAIRS');
  // Even nonzero samples are exploratory until separately reviewed.
  return {researchOnly:true,productionEligible:false,
    status:reasons.length?'BLOCKED':'EXPLORATORY_ONLY',reasons,
    indexAudit:audit.counts,pairedObservations:marketObservations,
    rejectedObservations:comparison.rejected,
    note:'No automatic promotion to trading, ranking, or notifications.'};
}
