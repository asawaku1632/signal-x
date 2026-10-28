import test from 'node:test';
import assert from 'node:assert/strict';
import {inventoryMarketBreadthRealOutcomes as inventory} from '../../lib/research/marketBreadthRealOutcomeInventory.mjs';
const e=(code='641A',id=1)=>({source:'BB',code,id,entryPrice:1200});
const r=(eventId=1,horizon=5)=>({source:'BB',eventId,horizon,returnPercent:3,futurePrice:1236});
test('fixture outcomes never count as real-code evidence',()=>{const x=inventory({events:[e('__DEV_BB_TRANSITION_47__')],results:[r()]});assert.equal(x.counts.matchedRealCodeResults,0);assert.equal(x.aiPromotionAuthorized,false)});
test('valid real code and price match descriptively',()=>{const x=inventory({events:[e()],results:[r()]});assert.equal(x.counts.matchedFiveSessionResults,1);assert.equal(x.independentImprovementVerified,false)});
test('orphan result rejected',()=>{const x=inventory({events:[e()],results:[r(2)]});assert.equal(x.rejected[0].reason,'NO_UNIQUE_REAL_CODE_EVENT')});
test('duplicate event ID quarantined',()=>{const x=inventory({events:[e('641A'),e('590A')],results:[r()]});assert.equal(x.counts.matchedRealCodeResults,0)});
test('invalid horizon excluded',()=>{const x=inventory({events:[e()],results:[r(1,7)]});assert.equal(x.counts.matchedRealCodeResults,0)});

test('invalid fixture sharing a valid ID cannot lend its result to real stock',()=>{const x=inventory({events:[e('__DEV_FIXTURE__'),e('641A')],results:[r()]});assert.equal(x.counts.matchedRealCodeResults,0);assert.equal(x.counts.duplicateEventKeys,1)});
test('invalid event arriving after real event still quarantines duplicate ID',()=>{const x=inventory({events:[e('641A'),e('__DEV_FIXTURE__')],results:[r()]});assert.equal(x.counts.matchedRealCodeResults,0)});
