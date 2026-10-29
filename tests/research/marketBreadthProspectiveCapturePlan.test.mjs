import test from 'node:test';
import assert from 'node:assert/strict';
import {assessMarketBreadthProspectiveCaptureReadiness as assess} from '../../lib/research/marketBreadthProspectiveCapturePlan.mjs';
const keys=['generatorTimestampAtCreation','sourceObservedAt','sourceBarEndAt','licensedProviderRightsEvidence','immutableSourceRecord','immutableSignalRecord','securityCodeBound','exchangeSessionCalendar','independentFiveSessionOutcome'];
test('no evidence means no prospective capture readiness',()=>{const x=assess();assert.equal(x.captureReady,false);assert.equal(x.missing.length,9);assert.equal(x.productionEligible,false)});
test('self-asserted truthy strings cannot pass evidence checks',()=>{const x=assess(Object.fromEntries(keys.map(k=>[k,'true'])));assert.equal(x.captureReady,false);assert.equal(x.verifiedRequirements,0)});
test('even all checklist items true never authorizes live integration',()=>{const x=assess(Object.fromEntries(keys.map(k=>[k,true])));assert.equal(x.captureReady,true);assert.equal(x.liveIntegrationAuthorized,false);assert.equal(x.productionEligible,false)});
test('malformed input is rejected',()=>{assert.throws(()=>assess([]),/INVALID_CAPTURE_READINESS_INPUT/)});
