import test from 'node:test';import assert from 'node:assert/strict';
import {auditMa75DecisionEvidence} from './ma75-asof-evidence-audit.mjs';
const row={date:'2026-10-29',prior75Sma:2481,distancePercent:36.434,
 minuteStatus:'HISTORICAL_METRICS_ONLY',post905:{referenceClose:3510,morningHighestHigh:3515,morningLowestLow:3415}};
test('never treats future morning low or daily close MA75 gap as 09:05 evidence',()=>{
 const r=auditMa75DecisionEvidence([row]);assert.equal(r.rows[0].morningHighLowKnownBy905,false);
 assert.equal(r.rows[0].ma75DistanceUsesSameDayClose,true);
 assert.equal(r.rows[0].lowTime,null);assert.equal(r.rows[0].usableAsVerified905Signal,false);
});
test('missing summary is not fabricated',()=>{
 const r=auditMa75DecisionEvidence([{date:'2026-08-03',minuteStatus:'MISSING_905_METRIC'}]);
 assert.equal(r.rows[0].reference905Close,null);assert.equal(r.rows[0].morningHighLowKnownAfter1000,false);
});
test('reject invalid date',()=>assert.throws(()=>auditMa75DecisionEvidence([{date:'tomorrow'}])));
