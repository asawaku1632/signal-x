import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeMarketBreadthLegacyFeatures as summarize} from '../../lib/research/marketBreadthLegacyDescriptiveSummary.mjs';
const bb={id:1,code:'641A',signal_date:'2026-08-10',created_at:'2026-08-11T10:50:00Z',side:'UPPER_OVERHEAT',raw_ai_power_after_bb:60,entry_price:100};
const tech={id:2,code:'6877',signal_trade_date:'2026-08-14',created_at:'2026-08-16T10:50:00Z',signal_type:'MACD',raw_ai_power_snapshot:40,entry_price:200};
test('legacy feature summary contains no performance metrics',()=>{const x=summarize({bbEvents:[bb],technicalEvents:[tech]});assert.equal(x.counts.descriptive,2);assert.equal(x.cohorts.length,2);assert.equal(x.performanceClaimsAllowed,false);assert.equal(x.productionEligible,false);assert.doesNotMatch(JSON.stringify(x),/winRate|return5d|profitRate/)});
test('mean saved AI POWER uses only finite values',()=>{const x=summarize({bbEvents:[bb,{...bb,id:3,code:'590A',raw_ai_power_after_bb:80},{...bb,id:4,code:'642A',raw_ai_power_after_bb:null}]});assert.equal(x.cohorts[0].meanSavedAiPower,70);assert.equal(x.cohorts[0].aiPowerSamples,2)});
test('development fixtures are excluded',()=>{const x=summarize({bbEvents:[bb,{...bb,id:5,code:'__DEV_BB_MISSING_47__'}]});assert.equal(x.counts.quarantined,1);assert.equal(x.cohorts[0].count,1)});
test('empty inventory stays empty',()=>{const x=summarize();assert.equal(x.cohorts.length,0);assert.equal(x.counts.verifiedForward,0)});

test('boolean AI POWER is not treated as numeric',()=>{const x=summarize({bbEvents:[{...bb,raw_ai_power_after_bb:true}]});assert.equal(x.cohorts[0].aiPowerSamples,0);assert.equal(x.cohorts[0].meanSavedAiPower,null)});
test('duplicate record identity cannot multiply descriptive counts',()=>{const x=summarize({bbEvents:[bb,{...bb}]});assert.equal(x.counts.descriptive,2);assert.equal(x.cohorts[0].count,2)});
