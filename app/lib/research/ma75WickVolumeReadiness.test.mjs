import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateMa75ForwardReadiness as readiness} from './ma75WickVolumeReadiness.mjs';
test('missing evidence fails closed',()=>{const r=readiness();assert.equal(r.approved,false);assert.equal(r.blockers.length,5)});
test('hypothetical fill cannot approve',()=>{const r=readiness({classification:{eligible:true,provenanceStatus:'TIMING_PLAUSIBLE_NOT_AUTHENTICATED'},outcome:{status:'HYPOTHETICAL_ONLY',fillVerified:false,budgetEligible:true},sourceAuthenticated:true,forwardValidated:true});assert.deepEqual(r.blockers,['FILL_NOT_VERIFIED'])});
test('even all evidence does not automatically approve production',()=>{const r=readiness({classification:{eligible:true,provenanceStatus:'TIMING_PLAUSIBLE_NOT_AUTHENTICATED'},outcome:{status:'HYPOTHETICAL_ONLY',fillVerified:true,budgetEligible:true},sourceAuthenticated:true,forwardValidated:true});assert.equal(r.approved,false);assert.equal(r.status,'SHADOW_NOT_APPROVED')});
