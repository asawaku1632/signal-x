import test from 'node:test';
import assert from 'node:assert/strict';
import {assessMarketBreadthRegimeReplication as assess} from '../../lib/research/marketBreadthRegimeReplication.mjs';
const row=(id,regime,ret,date='2026-10-28')=>({signalRecordId:id,tradeDate:date,fiveSessionReturnPercent:ret,independentlyAudited:true,marketRegime:regime,regimeSourceVerified:true});
test('empty data has no regime replication',()=>{const x=assess();assert.equal(x.regimeReplicationSampleReady,false);assert.equal(x.usableObservations,0)});
test('three regimes can meet sample thresholds without production authorization',()=>{const x=assess({observations:[row('a','RISING',5),row('b','FALLING',-3),row('c','SIDEWAYS',1)],minPerRegime:1,minDatesPerRegime:1});assert.equal(x.regimeReplicationSampleReady,true);assert.equal(x.aiPromotionAuthorized,false);assert.equal(x.regimes.FALLING.meanFiveSessionReturnPercent,-3)});
test('unverified regime source is excluded',()=>{const x=assess({observations:[{...row('a','RISING',5),regimeSourceVerified:false}],minPerRegime:1,minDatesPerRegime:1});assert.equal(x.regimes.RISING.sampleCount,0);assert.equal(x.excludedObservations,1)});
test('duplicate IDs across regimes are quarantined',()=>{const x=assess({observations:[row('a','RISING',5),row('a','FALLING',-5)],minPerRegime:1,minDatesPerRegime:1});assert.equal(x.usableObservations,0)});
test('missing falling regime blocks readiness',()=>{const x=assess({observations:[row('a','RISING',5),row('b','SIDEWAYS',2)],minPerRegime:1,minDatesPerRegime:1});assert.equal(x.regimeReplicationSampleReady,false);assert.equal(x.regimes.FALLING.sampleCount,0)});
