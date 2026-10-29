import test from 'node:test';
import assert from 'node:assert/strict';
import {assessMarketBreadthLegacyEvidenceReadiness as assess} from '../../lib/research/marketBreadthLegacyEvidenceReadiness.mjs';
test('many legacy events do not prove verified forward outcomes',()=>{const x=assess({bbEvents:425,technicalEvents:313,bbResults:5,technicalResults:0,featureCaptures:0});assert.equal(x.independentEvidenceReadyForManualReview,false);assert.equal(x.verifiedImprovement,false);assert.equal(x.aiPromotionAuthorized,false)});
test('empty inventory remains blocked',()=>{const x=assess();assert.ok(x.missing.includes('MINIMUM_VERIFIED_OUTCOME_PAIRS'))});
test('independent review threshold does not authorize production',()=>{const x=assess({verifiedOutcomePairs:30,verifiedTradeDates:10,originalSignalTimestampsVerified:true,providerRightsIndependentlyVerified:true});assert.equal(x.independentEvidenceReadyForManualReview,true);assert.equal(x.productionEligible,false)});
test('negative counts rejected',()=>{assert.throws(()=>assess({bbEvents:-1}),/INVALID_LEGACY_EVIDENCE_COUNTS/)});
test('fractional counts rejected',()=>{assert.throws(()=>assess({verifiedTradeDates:1.5}),/INVALID_LEGACY_EVIDENCE_COUNTS/)});
