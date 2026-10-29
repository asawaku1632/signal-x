import test from 'node:test';
import assert from 'node:assert/strict';
import {assessMarketBreadthPromotionReadiness as assess} from '../../lib/research/marketBreadthPromotionReadiness.mjs';
const group={n:100,uniqueDates:20,uniqueSymbols:30};
const report={researchOnly:true,productionEligible:false,evidenceCountsReconciled:true,cohortCountsReconciled:true,status:'DESCRIPTIVE_COMPARISON_READY',divergence:group,other:group};
test('even full descriptive data cannot activate trading',()=>{const r=assess(report);assert.equal(r.productionEligible,false);assert.equal(r.notificationEligible,false);assert.equal(r.readyForHumanResearchReview,true)});
test('empty data is blocked',()=>assert.equal(assess().readyForHumanResearchReview,false));
test('missing market cohort is blocked',()=>assert.ok(assess({...report,other:null}).blockers.includes('OTHER_SAMPLE_INSUFFICIENT')));
test('few dates block review',()=>assert.ok(assess({...report,divergence:{...group,uniqueDates:2}}).blockers.includes('DIVERGENCE_SAMPLE_INSUFFICIENT')));
test('few symbols block review',()=>assert.ok(assess({...report,other:{...group,uniqueSymbols:2}}).blockers.includes('OTHER_SAMPLE_INSUFFICIENT')));
test('untrusted production boundary blocks review',()=>assert.ok(assess({...report,productionEligible:true}).blockers.includes('RESEARCH_BOUNDARY_NOT_PROVEN')));
test('always requires independent license and human approval',()=>{const r=assess(report);assert.ok(r.blockers.includes('INDEPENDENT_LICENSE_AUDIT_NOT_ATTESTED'));assert.ok(r.blockers.includes('HUMAN_PRODUCTION_APPROVAL_REQUIRED'))});

test('caller cannot lower minimum observation count',()=>{const small={...group,n:50};const x=assess({...report,divergence:small},{minObservations:1,minDates:1,minSymbols:1});assert.equal(x.readyForHumanResearchReview,false);assert.ok(x.blockers.includes('DIVERGENCE_SAMPLE_INSUFFICIENT'))});
test('caller cannot lower minimum date or symbol counts',()=>{const small={...group,uniqueDates:5,uniqueSymbols:2};const x=assess({...report,other:small},{minObservations:0,minDates:0,minSymbols:0});assert.ok(x.blockers.includes('OTHER_SAMPLE_INSUFFICIENT'))});
test('higher caller thresholds still tighten review',()=>{const x=assess(report,{minObservations:150,minDates:30,minSymbols:40});assert.equal(x.readyForHumanResearchReview,false)});

test('human review is blocked if audit counts are not reconciled',()=>{const x=assess({...report,evidenceCountsReconciled:false});assert.equal(x.readyForHumanResearchReview,false);assert.ok(x.blockers.includes('EVIDENCE_ACCOUNTING_NOT_RECONCILED'))});
test('human review is blocked if cohort counts are not reconciled',()=>{const x=assess({...report,cohortCountsReconciled:false});assert.equal(x.readyForHumanResearchReview,false);assert.ok(x.blockers.includes('EVIDENCE_ACCOUNTING_NOT_RECONCILED'))});

test('readiness is explicitly scoped to descriptive research only',()=>{const x=assess(report);assert.equal(x.reviewScope,'DESCRIPTIVE_RESEARCH_ONLY');assert.equal(x.evidenceCollectionReady,false);assert.equal(x.productionEligible,false);assert.equal(x.notificationEligible,false)});

test('descriptive evidence never authorizes data collection',()=>{const x=assess(report);assert.equal(x.readyForHumanResearchReview,true);assert.equal(x.evidenceCollectionReady,false);assert.equal(x.productionEligible,false)});
