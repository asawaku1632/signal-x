import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyAggregateArithmetic} from '../../app/lib/research/dualSurgeIntegrity.mjs';
test('baseline counts balance',()=>{assert.equal(verifyAggregateArithmetic({events:24,matured:15,pending:9,positive:11,negative:4}).valid,true);});
test('status mismatch is rejected',()=>assert.equal(verifyAggregateArithmetic({events:24,matured:15,pending:8,positive:11,negative:4}).valid,false));
test('direction mismatch is rejected',()=>assert.equal(verifyAggregateArithmetic({events:24,matured:15,pending:9,positive:12,negative:4}).valid,false));
test('negative count throws',()=>assert.throws(()=>verifyAggregateArithmetic({events:-1,matured:0,pending:0,positive:0,negative:0})));
test('fractional count throws',()=>assert.throws(()=>verifyAggregateArithmetic({events:1.5,matured:1,pending:0,positive:1,negative:0})));
