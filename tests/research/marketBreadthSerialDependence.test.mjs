import test from 'node:test';
import assert from 'node:assert/strict';
import {assessMarketBreadthSerialDependence as assess} from '../../lib/research/marketBreadthSerialDependence.mjs';
const row=(code,date,research,baseline)=>({code,tradeDate:date,signalRecordId:'research:'+code+date,baselineRecordId:'baseline:'+code+date,researchReturnPercent:research,baselineReturnPercent:baseline,horizonSessions:5,researchIndependentlyAudited:true,baselineIndependentlyAudited:true,samePriceBasisVerified:true});
test('empty data has no HAC estimate',()=>{const r=assess();assert.equal(r.hacStandardError,null);assert.equal(r.reason,'INSUFFICIENT_DATES')});
test('one observed day has no HAC estimate',()=>{const r=assess({pairs:[row('641A','2026-10-28',5,1)]});assert.equal(r.observedDates,1);assert.equal(r.hacStandardError,null)});
test('two dates compute a finite interval without authorizing promotion',()=>{const r=assess({pairs:[row('641A','2026-10-28',2,0),row('590A','2026-10-29',4,0)],lags:1,minDates:2});assert.equal(r.observedDates,2);assert.equal(r.meanDailyDelta,3);assert.ok(Number.isFinite(r.hacStandardError));assert.equal(r.sampleReady,true);assert.equal(r.aiPromotionAuthorized,false)});
test('invalid lag selection rejected',()=>{assert.throws(()=>assess({lags:-1}),/INVALID_SERIAL_LAGS/);assert.throws(()=>assess({lags:51}),/INVALID_SERIAL_LAGS/)});
test('duplicate code/date observations excluded',()=>{const a=row('641A','2026-10-28',5,1);const r=assess({pairs:[a,a]});assert.equal(r.observedDates,0)});
