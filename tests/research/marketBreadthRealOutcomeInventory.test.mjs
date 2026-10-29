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

test('same event and horizon result cannot count twice',()=>{const x=inventory({events:[e()],results:[r(),r()]});assert.equal(x.counts.matchedFiveSessionResults,0);assert.equal(x.counts.duplicateResultKeys,1);assert.equal(x.rejected.length,2);assert.equal(x.rejected[0].reason,'DUPLICATE_EVENT_HORIZON_RESULT')});
test('different horizons remain distinct descriptive outcomes',()=>{const x=inventory({events:[e()],results:[r(1,1),r(1,5)]});assert.equal(x.counts.matchedRealCodeResults,2);assert.equal(x.counts.matchedFiveSessionResults,1)});

test('conflicting returns on same horizon are both quarantined',()=>{const x=inventory({events:[e()],results:[r(),{...r(),returnPercent:-4}]});assert.equal(x.counts.matchedFiveSessionResults,0);assert.equal(x.counts.rejectedResults,2)});
test('result order cannot decide which conflicting value survives',()=>{const a=r(),b={...r(),returnPercent:-4};const x=inventory({events:[e()],results:[b,a]});assert.equal(x.counts.matchedFiveSessionResults,0)});
