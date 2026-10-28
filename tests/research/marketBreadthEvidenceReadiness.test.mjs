import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewMarketBreadthLegacyData} from '../../lib/research/marketBreadthLegacyReview.mjs';
import {assessMarketBreadthEvidenceReadiness as assess} from '../../lib/research/marketBreadthEvidenceReadiness.mjs';
const review=reviewMarketBreadthLegacyData();
test('missing evidence reports all three blockers',()=>{const x=assess(review);assert.equal(x.missing.length,3);assert.equal(x.coveragePresent,false);assert.equal(x.researchCohortEligible,false)});
test('large historical inventory cannot substitute independent evidence',()=>{const x=assess(review);assert.equal(x.productionEligible,false);assert.equal(x.notificationEligible,false)});
test('coverage across sources does not prove row-level eligibility',()=>{const x=assess(review,{licensedBreadthCount:200,independentlyTimestampedSignals:200,verifiedFiveSessionOutcomes:200});assert.equal(x.coveragePresent,true);assert.equal(x.researchCohortEligible,false);assert.equal(x.automatedPromotionEligible,false)});
test('negative, fractional and missing review inputs fail closed',()=>{assert.throws(()=>assess(review,{licensedBreadthCount:-1}),/INVALID_EVIDENCE_READINESS_INPUT/);assert.throws(()=>assess(review,{verifiedFiveSessionOutcomes:1.2}),/INVALID_EVIDENCE_READINESS_INPUT/);assert.throws(()=>assess({}),/INVALID_EVIDENCE_READINESS_INPUT/)});
