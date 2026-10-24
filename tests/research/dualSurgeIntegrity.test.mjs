import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyAggregateArithmetic} from '../../app/lib/research/dualSurgeIntegrity.mjs';
test('baseline counts balance',()=>{assert.equal(verifyAggregateArithmetic({events:24,matured:15,pending:9,positive:11,negative:4}).valid,true);});
