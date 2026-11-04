import test from 'node:test';
import assert from 'node:assert/strict';
import {createMa75ForwardManifest} from '../app/lib/research/ma75ForwardProtocol.mjs';
import {summarizeMa75ForwardAudit} from '../app/lib/research/ma75ForwardAuditSummary.mjs';
const manifest=()=>createMa75ForwardManifest({
 frozenAt:'2026-10-31T08:00:00+09:00',firstSignalDate:'2026-11-02',
 cohortCodes:['3762','9984'],selectionPolicy:'Frozen liquid Japanese shares before future stock signals',
 source:{provider:'J-Quants',usageRights:'UNVERIFIED',corporateActions:'UNVERIFIED',timestampProvenance:'UNVERIFIED'}
});
const sig=(code,rising,volume)=>({code,tradeDate:'2026-11-02',
  variantMatches:{BREAKOUT_ALL:true,BREAKOUT_SMA75_RISING:rising,
    BREAKOUT_VOLUME_1_5:volume,BREAKOUT_BOTH:rising&&volume}});
const outcome=(id,status='PENDING_DATA',ret=1)=>({id,status,details:status==='COMPLETED'?
  {id,return5Percent:ret,maxAdverse5Percent:-3.2,budgetEligible:true}:null});
const snap=(p,candidates,results)=>({
 replay:{manifestSha256:p.manifestSha256,candidates},
 settlement:{manifestSha256:p.manifestSha256,results,totalCandidates:results.length,
  completed:results.filter(x=>x.status==='COMPLETED').length,
  pending:results.filter(x=>x.status.startsWith('PENDING_')).length,
  quarantined:results.filter(x=>x.status.startsWith('QUARANTINED_')).length},
});
test('summarizes same-cohort signals with separate complete pending and quarantine counts',()=>{
 const p=manifest();
 const {replay,settlement}=snap(p,[sig('3762',true,true),sig('9984',false,false)],[
   outcome('3762:2026-11-02','COMPLETED',4),
   outcome('9984:2026-11-02','PENDING_DATA')]);
 const r=summarizeMa75ForwardAudit(p,replay,settlement);
 assert.equal(r.integrityPass,false);
 assert.equal(r.structuralCoveragePass,false);
 assert.ok(r.issues.some(x=>x.reason==='MISSING_FROZEN_UNIVERSE_COVERAGE'));
 assert.equal(r.totals.completed,1);
 assert.equal(r.totals.pending,1);
 assert.equal(r.groups.find(x=>x.variant==='BREAKOUT_BOTH').signalCount,1);
 assert.equal(r.groups.find(x=>x.variant==='BREAKOUT_ALL').hypotheticalMeanReturn5Percent,4);
 assert.equal(r.groups.find(x=>x.variant==='BREAKOUT_ALL').hypotheticalPositive5Percent,100);
 assert.equal(r.validatedWinRate,null);
 assert.equal(r.eligibleForProduction,false);
});
test('no completion yields null means, not an invented zero-percent win rate',()=>{
 const p=manifest(),{replay,settlement}=snap(p,[sig('3762',true,false)],[
  outcome('3762:2026-11-02','PENDING_MISSING_BARS')]);
 const r=summarizeMa75ForwardAudit(p,replay,settlement);
 assert.equal(r.groups[0].hypotheticalMeanReturn5Percent,null);
 assert.equal(r.groups[0].hypotheticalPositive5Percent,null);
 assert.equal(r.unsupportedVariants[0].variant,'WAIT_FOR_RETEST_OR_CASH');
});
test('quarantined observation never adds to winner denominator',()=>{
 const p=manifest(),{replay,settlement}=snap(p,[sig('3762',true,true)],[
  outcome('3762:2026-11-02','QUARANTINED_CORPORATE_ACTION')]);
 const r=summarizeMa75ForwardAudit(p,replay,settlement);
 assert.equal(r.totals.quarantined,1);
 assert.equal(r.groups[0].completed,0);
 assert.equal(r.groups[0].hypotheticalPositive5Percent,null);
});
test('rejects duplicate replay or stray settlement or mismatched counter',()=>{
 const p=manifest();
 const c=sig('3762',true,true);
 let obj=snap(p,[c,c],[outcome('3762:2026-11-02')]);
 assert.ok(summarizeMa75ForwardAudit(p,obj.replay,obj.settlement).issues.some(x=>x.reason==='DUPLICATE_SIGNAL'));
 obj=snap(p,[c],[outcome('9984:2026-11-02')]);
 const r=summarizeMa75ForwardAudit(p,obj.replay,obj.settlement);
 assert.ok(r.issues.some(x=>x.reason==='OUTCOME_NOT_IN_REPLAY'));
 assert.ok(r.issues.some(x=>x.reason==='MISSING_OUTCOME_ROW'));
 obj=snap(p,[c],[outcome('3762:2026-11-02')]);
 obj.settlement.completed=1;
 assert.ok(summarizeMa75ForwardAudit(p,obj.replay,obj.settlement).issues.some(x=>x.reason==='COUNTER_MISMATCH'));
});
test('failed revision audit blocks integrity and cross-manifest rows throw',()=>{
 const p=manifest(),{replay,settlement}=snap(p,[sig('3762',true,true)],[outcome('3762:2026-11-02')]);
 const r=summarizeMa75ForwardAudit(p,replay,settlement,{revisionAudit:{
   manifestSha256:p.manifestSha256,validTransition:false}});
 assert.equal(r.integrityPass,false);
 assert.ok(r.issues.some(x=>x.reason==='REVISION_AUDIT_FAILED'));
 assert.throws(()=>summarizeMa75ForwardAudit(p,{...replay,manifestSha256:'bad'},settlement),TypeError);
});

test('structural integrity requires a complete frozen-universe coverage audit',()=>{
 const p=manifest();
 const {replay,settlement}=snap(p,[sig('3762',true,true)],[
   outcome('3762:2026-11-02','PENDING_DATA')]);
 const coverage={version:'ma75_universe_coverage_v1',manifestSha256:p.manifestSha256,
  integrityPass:true,coveragePercent:100,expectedCodeDates:2,unavailableCodeDates:0,
  observedBreakouts:1};
 const validated=summarizeMa75ForwardAudit(p,replay,settlement,{universeCoverage:coverage});
 assert.equal(validated.integrityPass,true);
 assert.equal(validated.structuralCoveragePass,true);
 assert.equal(validated.independentlyAuthenticatedCoverage,false);
 assert.equal(validated.validatedWinRate,null);
 const rejected=summarizeMa75ForwardAudit(p,replay,settlement,{universeCoverage:
  {...coverage,unavailableCodeDates:1,coveragePercent:50}});
 assert.equal(rejected.integrityPass,false);
 assert.ok(rejected.issues.some(x=>x.reason==='FAILED_FROZEN_UNIVERSE_COVERAGE'));
});
test('unmatched breakout count or mismatched manifest cannot claim complete coverage',()=>{
 const p=manifest(),obj=snap(p,[sig('3762',true,false)],[
  outcome('3762:2026-11-02')]);
 const base={version:'ma75_universe_coverage_v1',manifestSha256:p.manifestSha256,
  integrityPass:true,coveragePercent:100,expectedCodeDates:2,unavailableCodeDates:0,
  observedBreakouts:2};
 for(const coverage of [base,{...base,observedBreakouts:1,manifestSha256:'bad'}]) {
   const result=summarizeMa75ForwardAudit(p,obj.replay,obj.settlement,{universeCoverage:coverage});
   assert.equal(result.integrityPass,false);
   assert.equal(result.structuralCoveragePass,false);
 }
});
