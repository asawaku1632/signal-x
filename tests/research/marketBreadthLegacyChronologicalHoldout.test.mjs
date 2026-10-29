import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateLegacyChronologicalHoldout as evaluate} from '../../lib/research/marketBreadthLegacyChronologicalHoldout.mjs';
const rows=[['2026-08-01',1],['2026-08-02',3],['2026-08-03',-2],['2026-08-04',4],['2026-08-05',1],['2026-08-06',-1],['2026-08-07',2],['2026-08-08',5]].map(([date,changePercent])=>({date,code:'9983',score:85,changePercent,evaluatedTradeDate:new Date(Date.parse(date+'T00:00:00Z')+86400000).toISOString().slice(0,10)}));
const audit=(accepted=rows)=>({researchOnly:true,aiPromotionAuthorized:false,accepted,counts:{quarantined:0,rejected:0}});
test('chronological split preserves future holdout',()=>{const x=evaluate({audit:audit(),holdoutDate:'2026-08-06',minimumTrainingDates:4});assert.equal(x.training.observations,4);assert.equal(x.holdout.observations,3);assert.equal(x.diagnosticEligible,true)});
test('holdout never authorizes AI promotion',()=>{const x=evaluate({audit:audit(),holdoutDate:'2026-08-06'});assert.equal(x.aiPromotionAuthorized,false);assert.equal(x.independentImprovementVerified,false)});
test('insufficient training dates flagged',()=>{const x=evaluate({audit:audit(),holdoutDate:'2026-08-03'});assert.equal(x.diagnosticEligible,false);assert.ok(x.reasons.includes('INSUFFICIENT_TRAINING_DATES'))});
test('insufficient holdout dates flagged',()=>{const x=evaluate({audit:audit(),holdoutDate:'2026-08-08'});assert.equal(x.diagnosticEligible,false);assert.ok(x.reasons.includes('INSUFFICIENT_HOLDOUT_DATES'))});
test('empty dataset yields null metrics',()=>{const x=evaluate({audit:audit([]),holdoutDate:'2026-08-06'});assert.equal(x.training.meanReturnPercent,null);assert.equal(x.holdout.positiveRate,null)});
test('invalid audit fails closed',()=>assert.throws(()=>evaluate({audit:{accepted:rows},holdoutDate:'2026-08-06'}),/REQUIRES_SHADOW_AUDIT/));
test('invalid holdout date rejected',()=>assert.throws(()=>evaluate({audit:audit(),holdoutDate:'not-a-date'}),/INVALID_HOLDOUT_DATE/));
test('invalid date requirements rejected',()=>assert.throws(()=>evaluate({audit:audit(),holdoutDate:'2026-08-06',minimumTrainingDates:0}),/INVALID_DATE_REQUIREMENTS/));
test('invalid row rejected',()=>assert.throws(()=>evaluate({audit:audit([{date:'2026-08-01',score:80,changePercent:NaN}]),holdoutDate:'2026-08-06'}),/INVALID_AUDITED_ROW/));
test('quarantined source rows remain disclosed',()=>{const x=evaluate({audit:{...audit(),counts:{quarantined:2,rejected:1}},holdoutDate:'2026-08-06'});assert.ok(x.reasons.includes('EXCLUDED_UNVERIFIED_ROWS'))});
test('equal date average does not overweight a busy day',()=>{const extra=[...rows,{date:'2026-08-01',code:'9432',score:80,changePercent:9,evaluatedTradeDate:'2026-08-02'}];const x=evaluate({audit:audit(extra),holdoutDate:'2026-08-06'});assert.notEqual(x.training.meanReturnPercent,x.training.equalDateMeanReturnPercent)});

test('training outcome that overlaps holdout is embargoed',()=>{const sample=rows.map((r,i)=>i===3?{...r,evaluatedTradeDate:'2026-08-07'}:r);const x=evaluate({audit:audit(sample),holdoutDate:'2026-08-06'});assert.equal(x.excludedOverlappingTrainingOutcomes,1);assert.equal(x.training.observations,3);assert.ok(x.reasons.includes('TRAINING_OUTCOME_OVERLAPS_HOLDOUT'))});
test('duplicate stock-date in audited rows fails closed',()=>assert.throws(()=>evaluate({audit:audit([...rows,rows[0]]),holdoutDate:'2026-08-06'}),/DUPLICATE_AUDITED_STOCK_DATE/));
