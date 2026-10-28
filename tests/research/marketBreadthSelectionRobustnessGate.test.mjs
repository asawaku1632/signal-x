import test from 'node:test';
import assert from 'node:assert/strict';
import {assessMarketBreadthSelectionRobustness as assess} from '../../lib/research/marketBreadthSelectionRobustnessGate.mjs';
const dates=['2026-10-20','2026-10-21','2026-10-22','2026-10-23','2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30','2026-11-02'];
const row=(code,date,r,b)=>({code,tradeDate:date,signalRecordId:'research:'+code+date,baselineRecordId:'baseline:'+code+date,researchReturnPercent:r,baselineReturnPercent:b,horizonSessions:5,researchIndependentlyAudited:true,baselineIndependentlyAudited:true,samePriceBasisVerified:true});
test('positive descriptive robustness never promotes AI',()=>{const x=assess({pairs:[row('590A',dates[0],4,1),row('641A',dates[0],5,1)],verifiedSessions:dates,minSelectedDates:1});assert.equal(x.descriptiveSelectionRobustnessObserved,true);assert.equal(x.aiPromotionAuthorized,false);assert.equal(x.verifiedSelectionRobustness,false)});
test('one negative rule prevents positive robustness',()=>{const x=assess({pairs:[row('590A',dates[0],0,1),row('641A',dates[0],5,1)],verifiedSessions:dates,minSelectedDates:1});assert.equal(x.descriptiveSelectionRobustnessObserved,false)});
test('insufficient dates prevent robustness',()=>{const x=assess({pairs:[row('590A',dates[0],4,1)],verifiedSessions:dates,minSelectedDates:2});assert.equal(x.descriptiveSelectionRobustnessObserved,false);assert.ok(x.missing.includes('MINIMUM_DISJOINT_DATES_ACROSS_RULES'))});
