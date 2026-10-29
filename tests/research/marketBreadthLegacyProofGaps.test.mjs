import test from 'node:test';
import assert from 'node:assert/strict';
import {diagnoseMarketBreadthLegacyProofGaps as diagnose} from '../../lib/research/marketBreadthLegacyProofGaps.mjs';
const bb={id:1,code:'641A',signal_date:'2026-08-10',created_at:'2026-08-11T10:50:00Z'};
test('valid legacy row lists five missing independent proof requirements',()=>{const x=diagnose({bbEvents:[bb]});assert.equal(x.gaps.length,1);assert.equal(x.gaps[0].missing.length,5);assert.equal(x.counts.verifiedForward,0);assert.equal(x.productionEligible,false)});
test('development fixture remains quarantined',()=>{const x=diagnose({bbEvents:[{...bb,code:'__DEV_BB_TRANSITION_47__'}]});assert.equal(x.gaps[0].classification,'QUARANTINED');assert.deepEqual(x.gaps[0].missing,['DEV_OR_INVALID_SECURITY_CODE'])});
test('missing counts reflect each affected row',()=>{const x=diagnose({bbEvents:[bb,{...bb,id:2,code:'590A'}]});assert.equal(x.missingCounts.INDEPENDENT_SIGNAL_GENERATED_AT,2);assert.equal(x.missingCounts.INDEPENDENT_FIVE_SESSION_OUTCOME,2)});
test('empty inventory has no invented verified records',()=>{const x=diagnose();assert.equal(x.gaps.length,0);assert.equal(x.counts.verifiedForward,0)});
