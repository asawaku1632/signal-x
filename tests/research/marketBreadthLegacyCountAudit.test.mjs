import test from 'node:test';
import assert from 'node:assert/strict';
import {auditMarketBreadthLegacyCounts as audit} from '../../lib/research/marketBreadthLegacyCountAudit.mjs';
const counts={bbSignals:425,technicalSignals:313,scanCaptures:0,bbFiveDayResults:1,technicalFiveDayResults:0,bbAfterSignalDate:425,technicalAfterSignalDate:313};
test('legacy inventory stays descriptive, never verified from counts',()=>{const x=audit(counts);assert.equal(x.signalCount,738);assert.equal(x.recordedAfterNominalDate,738);assert.equal(x.independentlyVerifiedForwardOutcomes,null);assert.equal(x.forwardProofUse,'BLOCKED_UNTIL_RECORD_LEVEL_ATTESTATION');assert.equal(x.productionEligible,false)});
test('invalid counts are rejected',()=>{assert.throws(()=>audit({...counts,bbSignals:-1}),/INVALID_LEGACY_COUNT/);assert.throws(()=>audit({...counts,scanCaptures:0.5}),/INVALID_LEGACY_COUNT/)});
test('inconsistent counts are rejected',()=>{assert.throws(()=>audit({...counts,bbAfterSignalDate:426}),/INCONSISTENT_LEGACY_COUNT/);assert.throws(()=>audit({...counts,technicalFiveDayResults:314}),/INCONSISTENT_LEGACY_COUNT/)});
test('zero counts cannot establish verified results',()=>{const x=audit({bbSignals:0,technicalSignals:0,scanCaptures:0,bbFiveDayResults:0,technicalFiveDayResults:0,bbAfterSignalDate:0,technicalAfterSignalDate:0});assert.equal(x.independentlyVerifiedForwardOutcomes,null)});
