import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateMa75HistoricalSeries as evaluate} from './ma75WickVolumeOfflineEvaluation.mjs';
const bars=Array.from({length:83},(_,i)=>({time:1700000000+i*86400,open:100,high:103,low:98,close:100,volume:100}));
bars[75]={...bars[75],open:105,high:120,low:100,close:110,volume:200};
test('missing input rejected',()=>assert.equal(evaluate().status,'INVALID_INPUT'));
test('research results never imply forward validation',()=>{const r=evaluate({bars});assert.equal(r.summary.forwardValidated,false);assert.equal(r.summary.executionVerified,false)});
test('future bars cannot change earlier signal features',()=>{const a=evaluate({bars});const copy=bars.map(x=>({...x}));copy[76].close=80;const b=evaluate({bars:copy});const x=a.rows.find(x=>x.signalIndex===75),y=b.rows.find(x=>x.signalIndex===75);assert.ok(x);assert.ok(y);assert.equal(x.upperWickRatio,y.upperWickRatio);assert.equal(x.volumeRatio,y.volumeRatio)});
test('pending outcomes have no returns',()=>{const r=evaluate({bars:bars.slice(0,76)});assert.equal(r.summary.pendingCount,1);assert.equal(r.rows[0].returnPercent,null)});

test('summary exposes losses and does not silently count pending outcomes',()=>{const r=evaluate({bars});assert.equal(r.summary.observedSessionCount,8);assert.equal(r.summary.candidateCount,1);assert.equal(r.summary.measuredCount,1);assert.equal(r.summary.pendingCount,0);assert.equal(r.summary.negativeCount,1);assert.ok(r.summary.minReturnPercent<0);assert.equal(r.summary.maxReturnPercent,r.summary.minReturnPercent)});
