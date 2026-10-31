import test from 'node:test';
import assert from 'node:assert/strict';
import {auditMa75SettlementRevisions} from '../app/lib/research/ma75SettlementRevisions.mjs';
const HASH='a'.repeat(64);
const details=(id='3762:2026-11-02')=>({
  id,return5Percent:2.5,evidenceDigest:'b'.repeat(64),profit5Yen100:5000,
});
const row=(status='PENDING_DATA',id='3762:2026-11-02')=>({
  id,status,details:status==='COMPLETED'?details(id):null,
});
const snap=(rows,hash=HASH)=>({
  version:'ma75_forward_outcome_v1',manifestSha256:hash,results:rows,
  totalCandidates:rows.length,completed:rows.filter(x=>x.status==='COMPLETED').length,
  pending:rows.filter(x=>x.status.startsWith('PENDING_')).length,
  quarantined:rows.filter(x=>x.status.startsWith('QUARANTINED_')).length,
});
test('allows strictly pending to completed and never treats the change as validated forward performance',()=>{
 const a=snap([row()]);
 const b=snap([row('COMPLETED')]);
 const result=auditMa75SettlementRevisions(a,b);
 assert.equal(result.validTransition,true);
 assert.equal(result.matured,1);
 assert.equal(result.stableCompleted,0);
 assert.equal(result.eligibleForProduction,false);
 assert.equal(result.independentlyVerifiedForwardReturn,null);
});
test('identical completed evidence remains stable across subsequent passes',()=>{
 const a=snap([row('COMPLETED')]);
 const b=snap([row('COMPLETED')]);
 const r=auditMa75SettlementRevisions(a,b);
 assert.equal(r.stableCompleted,1);
 assert.deepEqual(r.issues,[]);
});
test('changed completed realized return or evidence digest cannot silently overwrite',()=>{
 const a=snap([row('COMPLETED')]);
 for(const key of ['return5Percent','evidenceDigest']){
   const modified=row('COMPLETED');modified.details[key]=key==='return5Percent'?-4:'c'.repeat(64);
   const r=auditMa75SettlementRevisions(a,snap([modified]));
   assert.equal(r.validTransition,false);
   assert.ok(r.issues.some(x=>x.reason==='COMPLETED_OUTCOME_CHANGED'));
 }
});
test('disappearance of any previous candidate is detected',()=>{
 const r=auditMa75SettlementRevisions(snap([row()]),snap([]));
 assert.equal(r.validTransition,false);
 assert.equal(r.issues[0].reason,'MISSING_PREVIOUS_SIGNAL');
});
test('duplicate candidate IDs and inconsistent counters are quarantined',()=>{
 const r=auditMa75SettlementRevisions(snap([row()]),snap([row(),row()]));
 assert.equal(r.validTransition,false);
 assert.ok(r.issues.some(x=>x.reason==='CURRENT_DUPLICATE'));
 const wrong=snap([row('COMPLETED')]);wrong.completed=0;
 const q=auditMa75SettlementRevisions(snap([]),wrong);
 assert.ok(q.issues.some(x=>x.reason==='INCONSISTENT_COUNTS'));
});
test('quarantine cannot be silently promoted to completed',()=>{
 const r=auditMa75SettlementRevisions(snap([row('QUARANTINED_CORPORATE_ACTION')]),snap([row('COMPLETED')]));
 assert.equal(r.validTransition,false);
 assert.equal(r.manualReview,1);
 assert.ok(r.issues.some(x=>x.reason==='QUARANTINE_STATUS_CHANGED_WITHOUT_REVIEW'));
});
test('pending to quarantine requires manual review and not a profit',()=>{
 const r=auditMa75SettlementRevisions(snap([row('PENDING_DATA')]),snap([row('QUARANTINED_BAR_OR_PROVENANCE')]));
 assert.equal(r.validTransition,false);
 assert.equal(r.manualReview,1);
 assert.ok(r.issues.some(x=>x.reason==='PENDING_TO_QUARANTINE_REQUIRES_REVIEW'));
});
test('wrong cohort SHA, invalid statuses, non-completed details and malformed proof are rejected',()=>{
 assert.throws(()=>auditMa75SettlementRevisions(snap([]),snap([], 'x'.repeat(64))),TypeError);
 const bad=snap([row('COMPLETED')]);bad.results[0].details.evidenceDigest='fake';
 assert.equal(auditMa75SettlementRevisions(snap([]),bad).validTransition,false);
 const body=snap([row()]);body.results[0].details={profit:100};
 assert.equal(auditMa75SettlementRevisions(snap([]),body).validTransition,false);
});
test('newly observed candidates remain visible, not silently absorbed into old results',()=>{
 const later=snap([row('PENDING_DATA'),row('PENDING_CALENDAR_HORIZON','9984:2026-11-02')]);
 const r=auditMa75SettlementRevisions(snap([row()]),later);
 assert.equal(r.newlyObservedSignals,1);
 assert.equal(r.stillPending,1);
 assert.equal(r.validTransition,true);
});

test('newly backfilled completed outcome is not treated as genuinely prospective',()=>{
 const old=snap([]);
 const injected=snap([row('COMPLETED')]);
 const r=auditMa75SettlementRevisions(old,injected);
 assert.equal(r.validTransition,false);
 assert.equal(r.newlyObservedSignals,1);
 assert.ok(r.issues.some(x=>x.reason==='NEW_COMPLETED_SIGNAL_WITHOUT_PRIOR_OBSERVATION'));
});
