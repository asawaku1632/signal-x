// Research-only, deterministic, read-only pipeline. No external I/O.
import {auditMarketBreadthEvidence} from './marketBreadthEvidenceAudit.mjs';
import {summarizeBreadthResearchCohorts} from './marketBreadthCohortSummary.mjs';
import {buildMarketBreadthResearchReport} from './marketBreadthResearchReport.mjs';
const cohortSet=new Set(['INDEX_BREADTH_DIVERGENCE','OBSERVED']);
export function runMarketBreadthResearchReview(rows,resolveEvidence,{generatedAt,minPerCohort=30,minDates=10}={}){
 const audit=auditMarketBreadthEvidence(rows,resolveEvidence);
 const verified=audit.accepted.map(r=>{
  const source=(Array.isArray(rows)?rows:[]).find(x=>x?.tradeDate===r.tradeDate&&x?.code===r.code&&x?.signalGeneratedAt===r.signalGeneratedAt);
  const status=source?.marketStatus;
  return {...r,eligible:true,marketStatus:cohortSet.has(status)?status:null};
 });
 const cohorts=summarizeBreadthResearchCohorts(verified,{minPerCohort,minDates});
 const report=buildMarketBreadthResearchReport({audit,cohorts,generatedAt});
 return {researchOnly:true,productionEligible:false,audit,cohorts,report};
}
