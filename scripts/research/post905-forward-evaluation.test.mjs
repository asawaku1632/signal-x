import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateForward} from './post905-forward-evaluation.mjs';
const row=(date='2026-10-30')=>({
 code:'1301',date,strategy:'demo',independentCapture:true,sourceVerified:true,lookaheadFreeVerified:true,
 lastInputBarEndAt:date+'T09:04:00+09:00',receivedAt:date+'T09:04:30+09:00',
 decisionAt:date+'T09:05:00+09:00',entryAt:date+'T09:06:00+09:00',exitAt:new Date(Date.parse(date+'T10:00:00+09:00')+86400000).toISOString(),
 entryPrice:100,exitPrice:102,fillVerified:true,holdingTradingDays:1,outcomeComplete:true,outcomeKnownAtDecision:false
});
const opts={cutoffDate:'2026-10-29',feeBps:10,slippageBps:5};
test('valid chronology computes gross and round-trip costs but cannot promote signals',()=>{
 const result=evaluateForward([row()],opts);
 assert.equal(result.accepted,1);
 assert.equal(result.test.meanNetPercent,1.7);
 assert.equal(result.test.positiveRatePercent,100);
 assert.equal(result.verifiedTradingEdge,false);
 assert.equal(result.eligibleForNotifications,false);
 assert.equal(result.eligibleForProduction,false);
});
test('future input at 09:06 is rejected',()=>{
 const r=row();r.lastInputBarEndAt=r.date+'T09:06:00+09:00';
 assert.equal(evaluateForward([r],opts).rejected.INVALID_TIMELINE,1);
});
test('unverified independent capture and fill are rejected',()=>{
 assert.equal(evaluateForward([{...row(),independentCapture:false}],opts).rejected.UNVERIFIED_ASOF_EVIDENCE,1);
 assert.equal(evaluateForward([{...row(),fillVerified:false}],opts).rejected.UNVERIFIED_FILL,1);
});
test('train and test split by fixed chronological cutoff',()=>{
 const result=evaluateForward([row('2026-10-29'),row('2026-10-30')],opts);
 assert.equal(result.train.n,1);assert.equal(result.test.n,1);
 assert.equal(result.sufficientlySampled,false);
});
test('duplicate scopes and malformed dates fail closed',()=>{
 assert.throws(()=>evaluateForward([row(),row()],opts),/DUPLICATE_SCOPE/);
 assert.equal(evaluateForward([{...row(),date:'2026-13-01'}],opts).rejected.INVALID_SCOPE,1);
});
test('no records or invalid costs fail closed',()=>{
 assert.throws(()=>evaluateForward([],opts),/INVALID_ROWS/);
 assert.throws(()=>evaluateForward([row()],{...opts,feeBps:-1}),/INVALID_CONFIG/);
});

test('same-day exit cannot masquerade as one-day forward outcome',()=>{
 const r=row();r.exitAt=r.date+'T10:00:00+09:00';
 assert.equal(evaluateForward([r],opts).rejected.INVALID_HOLDING_PERIOD,1);
});
