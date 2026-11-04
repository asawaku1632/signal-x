import test from 'node:test';
import assert from 'node:assert/strict';
import {createMa75ForwardManifest} from '../app/lib/research/ma75ForwardProtocol.mjs';
import {auditMa75ResearchReviewGate,MA75_MIN_REVIEW_COUNTS} from '../app/lib/research/ma75ResearchReviewGate.mjs';
const codes=Array.from({length:40},(_,i)=>String(1100+i));
const dates=['01','02','03'].flatMap(month=>Array.from({length:10},(_,j)=>
  '2027-'+month+'-'+String(j+2).padStart(2,'0')));
const freeze=()=>createMa75ForwardManifest({
  frozenAt:'2026-10-31T10:00:00+09:00',firstSignalDate:'2027-01-01',
  cohortCodes:codes,selectionPolicy:'All predeclared full-stock liquidity selection from future sessions',
  source:{provider:'J-Quants',usageRights:'VERIFIED',corporateActions:'VERIFIED',
    timestampProvenance:'VERIFIED'},
});
const fixture=()=>{
  const p=freeze(),sha=p.manifestSha256;
  const observations=Array.from({length:120},(_,i)=>{
    const code=codes[i%40],signalDate=dates[Math.floor(i/4)];
    const id=code+':'+signalDate;
    const waitCash=i%2===0;
    return {id,status:'COMPLETED_HYPOTHETICAL',detail:{id,code,signalDate,
      waitCash,waitTraded:!waitCash,
      breakoutReturn5Percent:1.5,waitReturn5Percent:waitCash?0:2}};
  });
  return {p,evidence:{
    universeCoverage:{version:'ma75_universe_coverage_v1',
      manifestSha256:sha,integrityPass:true,coveragePercent:100,
      unavailableCodeDates:0,expectedCodeDates:1200,observedBreakouts:120},
    forwardSummary:{version:'ma75_forward_summary_v1',
      manifestSha256:sha,integrityPass:true,structuralCoveragePass:true,
      independentlyAuthenticatedCoverage:false,eligibleForProduction:false,
      totals:{total:120,completed:120,pending:0,quarantined:0},
      groups:[{variant:'BREAKOUT_ALL',signalCount:120}]},
    waitPolicy:{version:'ma75_forward_wait_policy_v1',
      manifestSha256:sha,observations,
      candidates:120,complete:120,pending:0,quarantined:0,
      eligibleForProduction:false,validatedForwardWinRate:null},
    revisionAudit:{version:'ma75_settlement_revision_audit_v1',
      manifestSha256:sha,validTransition:true},
  }};
};
test('no input evidence blocks all live functions',()=>{
 const p=freeze(),r=auditMa75ResearchReviewGate(p);
 assert.equal(r.technicalPrecheckPass,false);
 assert.equal(r.eligibleForHumanIndependentReview,false);
 assert.equal(r.eligibleForProduction,false);
 assert.equal(r.eligibleForNotifications,false);
 assert.equal(r.eligibleForAIPowerScoring,false);
 assert.equal(r.independentlyValidatedForwardWinRate,null);
 assert.ok(r.blockers.includes('INCOMPLETE_FROZEN_UNIVERSE'));
});
test('synthetically sufficient structure can only request independent human review',()=>{
 const {p,evidence}=fixture();
 const r=auditMa75ResearchReviewGate(p,evidence);
 assert.equal(r.technicalPrecheckPass,true);
 assert.equal(r.eligibleForHumanIndependentReview,true);
 assert.equal(r.blockers.length,0);
 assert.equal(r.counts.completedWaitOpportunities,120);
 assert.equal(r.counts.distinctStockCodes,40);
 assert.equal(r.counts.distinctSignalDates,30);
 assert.equal(r.counts.distinctCalendarMonths,3);
 assert.equal(r.counts.cash,60);
 assert.equal(r.counts.traded,60);
 assert.equal(r.status,'AWAITING_INDEPENDENT_EXTERNAL_AUDIT');
 assert.equal(r.structuralSignalPopulationAligned,true);
 assert.equal(r.allOutcomesMature,true);
 assert.equal(r.eligibleForNotifications,false);
 assert.equal(r.eligibleForProduction,false);
 assert.equal(r.externallyVerifiedProviderAndRights,false);
 assert.equal(r.independentlyValidatedForwardWinRate,null);
});
test('a complete returns table is invalid if frozen non-signal universe is missing',()=>{
 const {p,evidence}=fixture();evidence.universeCoverage.unavailableCodeDates=1;
 const r=auditMa75ResearchReviewGate(p,evidence);
 assert.ok(r.blockers.includes('INCOMPLETE_FROZEN_UNIVERSE'));
 assert.equal(r.technicalPrecheckPass,false);
});
test('do not treat short samples or single market month as scientific proof',()=>{
 const {p,evidence}=fixture();
 evidence.waitPolicy.observations=evidence.waitPolicy.observations.slice(0,25);
 evidence.waitPolicy.complete=25;
 const r=auditMa75ResearchReviewGate(p,evidence);
 assert.ok(r.blockers.includes('INSUFFICIENT_FIFTEEN_SESSION_RESULTS'));
 assert.ok(r.blockers.includes('INSUFFICIENT_DISTINCT_SIGNAL_DATES'));
 assert.ok(r.blockers.includes('INSUFFICIENT_DISTINCT_CALENDAR_MONTHS'));
 assert.equal(r.eligibleForProduction,false);
});
test('duplicate completed opportunities or a fake no-trade payoff invalidates denominator',()=>{
 for(const change of ['duplicate','cash']){
   const {p,evidence}=fixture();
   if(change==='duplicate')evidence.waitPolicy.observations[1]=evidence.waitPolicy.observations[0];
   else evidence.waitPolicy.observations[0].detail.waitReturn5Percent=8;
   const r=auditMa75ResearchReviewGate(p,evidence);
   assert.ok(r.blockers.includes('UNVERIFIED_WAIT_POLICY_DENOMINATOR'));
 }
});
test('pending, quarantined, missing trade and cash mix are visible blockers',()=>{
 const {p,evidence}=fixture();
 evidence.waitPolicy.observations[0]={id:'1100:2027-01-02',status:'PENDING_DATA',detail:null};
 evidence.waitPolicy.complete=119;evidence.waitPolicy.pending=1;
 const r=auditMa75ResearchReviewGate(p,evidence);
 assert.ok(r.blockers.includes('INSUFFICIENT_WAIT_CASH_COMPARISON')===false);
 assert.equal(r.counts.completedWaitOpportunities,119);
 evidence.waitPolicy.observations=evidence.waitPolicy.observations.filter(x=>x.status==='COMPLETED_HYPOTHETICAL');
 evidence.waitPolicy.complete=119;evidence.waitPolicy.pending=0;
 const q=auditMa75ResearchReviewGate(p,evidence);
 assert.equal(q.counts.completedWaitOpportunities,119);
 assert.equal(q.eligibleForProduction,false);
});
test('different cohort hash or failed revision reconciliation blocks human review',()=>{
 const {p,evidence}=fixture();
 evidence.revisionAudit.validTransition=false;
 assert.ok(auditMa75ResearchReviewGate(p,evidence).blockers.includes('REVISION_INTEGRITY_NOT_VERIFIED'));
 evidence.revisionAudit.validTransition=true;
 evidence.forwardSummary.manifestSha256='fake';
 assert.ok(auditMa75ResearchReviewGate(p,evidence).blockers.includes('INCOMPLETE_BREAKOUT_SUMMARY'));
});
test('mutable synthetic source statuses cannot authorize live scoring',()=>{
 const {p,evidence}=fixture();
 assert.equal(p.source.usageRights,'VERIFIED');
 const r=auditMa75ResearchReviewGate(p,evidence);
 assert.equal(r.externallyVerifiedProviderAndRights,false);
 assert.equal(r.independentlyCertifiedSignalCapture,false);
 assert.equal(r.independentlyVerifiedRiskAndCosts,false);
 assert.equal(r.eligibleForProduction,false);
 assert.ok(MA75_MIN_REVIEW_COUNTS.wait15dComplete>0);
});
test('invalid original manifest always throws, instead of fallback to retrospective',()=>{
 const {p,evidence}=fixture();
 assert.throws(()=>auditMa75ResearchReviewGate({...p,codes:['0000']},evidence),TypeError);
});

test('mismatched breakout and waiting denominators block even if each has 100 completed trades',()=>{
 for(const scenario of ['summary','universe','groups','wait']){
   const {p,evidence}=fixture();
   if(scenario==='summary')evidence.forwardSummary.totals.total=125;
   else if(scenario==='universe')evidence.universeCoverage.observedBreakouts=125;
   else if(scenario==='groups')evidence.forwardSummary.groups[0].signalCount=125;
   else evidence.waitPolicy.candidates=125;
   const r=auditMa75ResearchReviewGate(p,evidence);
   assert.equal(r.technicalPrecheckPass,false);
   assert.equal(r.structuralSignalPopulationAligned,false);
   assert.ok(r.blockers.includes('MISMATCHED_FROZEN_SIGNAL_POPULATION'));
 }
});
test('pending or quarantined results prohibit complete independent review precheck',()=>{
 for(const pendingOn of ['forward','wait']){
   const {p,evidence}=fixture();
   if(pendingOn==='forward'){evidence.forwardSummary.totals.pending=1;}
   else {
     evidence.waitPolicy.observations[0]={...evidence.waitPolicy.observations[0],
       status:'PENDING_MISSING_BARS',detail:null};
     evidence.waitPolicy.complete=119;evidence.waitPolicy.pending=1;
   }
   const r=auditMa75ResearchReviewGate(p,evidence);
   assert.equal(r.allOutcomesMature,false);
   assert.ok(r.blockers.includes('UNRESOLVED_OR_QUARANTINED_OUTCOMES'));
   assert.equal(r.eligibleForProduction,false);
 }
});
test('duplicate pending signals or out-of-cohort identifiers reject all-outcomes denominator',()=>{
 for(const problem of ['duplicate','unknown']){
  const {p,evidence}=fixture();
  evidence.waitPolicy.observations[0]={
   id:problem==='duplicate'?evidence.waitPolicy.observations[1].id:'9999:2027-01-02',
   status:'PENDING_DATA',detail:null};
  evidence.waitPolicy.complete=119;evidence.waitPolicy.pending=1;
  const r=auditMa75ResearchReviewGate(p,evidence);
  assert.equal(r.structuralSignalPopulationAligned,false);
  assert.ok(r.blockers.includes('MISMATCHED_FROZEN_SIGNAL_POPULATION'));
 }
});
