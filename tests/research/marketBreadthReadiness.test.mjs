import test from 'node:test';
import assert from 'node:assert/strict';
import {marketBreadthResearchReadiness} from '../../lib/research/marketBreadthReadiness.mjs';
test('empty research blocks promotion',()=>{
 const r=marketBreadthResearchReadiness();
 assert.equal(r.status,'BLOCKED');assert.equal(r.productionEligible,false);
 assert.ok(r.reasons.includes('NO_BREADTH_SNAPSHOTS'));
});
test('pending license is reported explicitly',()=>{
 const r=marketBreadthResearchReadiness({indexRows:[{status:'unavailable',reason:'PROVIDER_APPROVAL_REQUIRED'}]});
 assert.ok(r.reasons.includes('INDEX_PROVIDER_APPROVAL_PENDING'));
 assert.equal(r.productionEligible,false);
});
