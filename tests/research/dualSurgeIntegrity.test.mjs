import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyAggregateArithmetic,checkBaselineManifest,compareDenominators} from '../../app/lib/research/dualSurgeIntegrity.mjs';
test('baseline counts balance',()=>{assert.equal(verifyAggregateArithmetic({events:24,matured:15,pending:9,positive:11,negative:4}).valid,true);});
test('status mismatch is rejected',()=>assert.equal(verifyAggregateArithmetic({events:24,matured:15,pending:8,positive:11,negative:4}).valid,false));
test('direction mismatch is rejected',()=>assert.equal(verifyAggregateArithmetic({events:24,matured:15,pending:9,positive:12,negative:4}).valid,false));
test('negative count throws',()=>assert.throws(()=>verifyAggregateArithmetic({events:-1,matured:0,pending:0,positive:0,negative:0})));
test('fractional count throws',()=>assert.throws(()=>verifyAggregateArithmetic({events:1.5,matured:1,pending:0,positive:1,negative:0})));
test('manifest does not imply event evidence',()=>assert.equal(checkBaselineManifest({selectedStocks:20,detectorEligibleStocks:19,eventCounts:{independentFirstEvents:24,maturedFiveSession:15,pendingFiveSession:9,positiveFiveSession:11,negativeFiveSession:4}}).evidenceComplete,false));
test('equal denominator is comparable',()=>assert.equal(compareDenominators({matured:15},{matured:15}).comparable,true));
test('unequal denominator is not comparable',()=>assert.equal(compareDenominators({matured:15},{matured:12}).comparable,false));
test('zero denominator is not comparable',()=>assert.equal(compareDenominators({matured:0},{matured:0}).comparable,false));
test('invalid denominator throws',()=>assert.throws(()=>compareDenominators({matured:null},{matured:2})));

test('negative manifest stock count rejected',()=>assert.throws(()=>checkBaselineManifest({selectedStocks:-1,detectorEligibleStocks:0,eventCounts:{}}),/INVALID_MANIFEST/));
test('negative denominator rejected',()=>assert.throws(()=>compareDenominators({matured:-1},{matured:1}),/INVALID_DENOMINATOR/));
test('eligible stock count cannot exceed selected',()=>{const m={selectedStocks:1,detectorEligibleStocks:2,eventCounts:{independentFirstEvents:1,maturedFiveSession:1,pendingFiveSession:0,positiveFiveSession:1,negativeFiveSession:0}};assert.equal(checkBaselineManifest(m).eligibleNotMoreThanSelected,false)});
