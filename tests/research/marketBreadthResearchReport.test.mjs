import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMarketBreadthResearchReport as report} from '../../lib/research/marketBreadthResearchReport.mjs';
const group={n:30,uniqueDates:10,uniqueSymbols:20,mean5dPct:2,median5dPct:1,positiveRate:0.6};
test('empty inputs show insufficient evidence',()=>{const r=report();assert.equal(r.status,'INSUFFICIENT_VERIFIED_EVIDENCE');assert.equal(r.productionEligible,false)});
test('verified comparison yields display-ready descriptive report',()=>{const r=report({audit:{acceptedCount:60,rejectedCount:2,rejectionCounts:{DUPLICATE:2}},cohorts:{comparisonReady:true,divergence:group,other:{...group,mean5dPct:1},deltaMean5dPct:1},generatedAt:'2026-10-28T16:00:00+09:00'});assert.equal(r.status,'DESCRIPTIVE_COMPARISON_READY');assert.equal(r.deltaMean5dPct,1);assert.equal(r.rejectionCounts.DUPLICATE,2)});
test('never promotes production even with sufficient cohorts',()=>assert.equal(report({cohorts:{comparisonReady:true,divergence:group,other:group}}).productionEligible,false));
test('missing comparison cohort blocks report',()=>assert.equal(report({cohorts:{comparisonReady:true,divergence:group}}).status,'INSUFFICIENT_VERIFIED_EVIDENCE'));
test('invalid timestamps become null',()=>assert.equal(report({generatedAt:'yesterday'}).generatedAt,null));
test('invalid numeric fields are not displayed as data',()=>assert.equal(report({cohorts:{divergence:{...group,mean5dPct:Infinity}}}).divergence.mean5dPct,null));
test('invalid rejection reason keys are ignored',()=>assert.deepEqual(report({audit:{rejectionCounts:{'bad key':5,VALID_REASON:2}}}).rejectionCounts,{VALID_REASON:2}));
test('invalid negative counts are not displayed',()=>assert.equal(report({audit:{acceptedCount:-1}}).acceptedEvidenceCount,0));

test('caller supplied ready flag cannot bypass minimum samples',()=>{const r=report({audit:{acceptedCount:2},cohorts:{comparisonReady:true,divergence:{...group,n:1},other:{...group,n:1}}});assert.equal(r.status,'INSUFFICIENT_VERIFIED_EVIDENCE')});
test('caller supplied ready flag cannot bypass trading-day floor',()=>{const r=report({audit:{acceptedCount:60},cohorts:{comparisonReady:true,divergence:{...group,uniqueDates:1},other:group}});assert.equal(r.status,'INSUFFICIENT_VERIFIED_EVIDENCE')});
test('audit count must reconcile with cohort totals',()=>{const r=report({audit:{acceptedCount:999},cohorts:{comparisonReady:true,divergence:group,other:group}});assert.equal(r.status,'INSUFFICIENT_VERIFIED_EVIDENCE')});
