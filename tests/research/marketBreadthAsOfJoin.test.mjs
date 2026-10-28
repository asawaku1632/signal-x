import test from 'node:test';
import assert from 'node:assert/strict';
import {joinMarketBreadthResearch} from '../../lib/research/marketBreadthAsOfJoin.mjs';
const m={tradeDate:'2026-10-28',observedAt:'2026-10-28T09:00:00+09:00',source:'licensed',licenseVerified:true,nikkeiChangePct:1,topixChangePct:-1,advancers:400,decliners:1100,unchanged:20};
const s={tradeDate:'2026-10-28',code:'641A',signalGeneratedAt:'2026-10-28T09:15:00+09:00'};
test('joins verified market snapshot strictly before signal',()=>{const r=joinMarketBreadthResearch([m],[s]);assert.equal(r.joined.length,1);assert.equal(r.productionEligible,false)});
test('excludes market observations after signal',()=>assert.equal(joinMarketBreadthResearch([{...m,observedAt:'2026-10-28T09:20:00+09:00'}],[s]).joined.length,0));
test('uses latest eligible observation, never later snapshot',()=>{const r=joinMarketBreadthResearch([m,{...m,observedAt:'2026-10-28T09:10:00+09:00'},{...m,observedAt:'2026-10-28T09:30:00+09:00'}],[s]);assert.equal(r.joined[0].marketObservedAt,'2026-10-28T09:10:00+09:00')});
test('same-time duplicate is quarantined',()=>assert.equal(joinMarketBreadthResearch([m,m],[s]).rejected[0].reason,'AMBIGUOUS_MARKET_OBSERVATION'));
test('unlicensed snapshot never joins',()=>assert.equal(joinMarketBreadthResearch([{...m,licenseVerified:false}],[s]).joined.length,0));
test('no valid signal timestamp never joins',()=>assert.equal(joinMarketBreadthResearch([m],[{...s,signalGeneratedAt:'2026-10-28T09:15:00'}]).joined.length,0));
test('alphanumeric JP code accepted',()=>assert.equal(joinMarketBreadthResearch([m],[s]).joined[0].code,'641A'));

test('invalid signal calendar day never joins',()=>assert.equal(joinMarketBreadthResearch([m],[{...s,signalGeneratedAt:'2026-02-30T09:15:00+09:00'}]).joined.length,0));
test('invalid signal clock never joins',()=>assert.equal(joinMarketBreadthResearch([m],[{...s,signalGeneratedAt:'2026-10-28T25:15:00+09:00'}]).joined.length,0));

test('signal from a different JST trading date cannot join previous day market snapshot',()=>{const r=joinMarketBreadthResearch([m],[{...s,signalGeneratedAt:'2026-10-29T09:15:00+09:00'}]);assert.equal(r.joined.length,0);assert.equal(r.rejected[0].reason,'NO_VERIFIED_AS_OF_MATCH')});
test('UTC timestamp resolving to same JST trading date can join',()=>{const r=joinMarketBreadthResearch([m],[{...s,signalGeneratedAt:'2026-10-28T00:15:00Z'}]);assert.equal(r.joined.length,1)});

test('market snapshot observed on previous JST date is excluded',()=>{const x={...m,observedAt:'2026-10-27T23:59:00+09:00'};assert.equal(joinMarketBreadthResearch([x],[s]).joined.length,0)});
test('market snapshot observed on future JST date is excluded',()=>{const x={...m,observedAt:'2026-10-29T00:01:00+09:00'};assert.equal(joinMarketBreadthResearch([x],[s]).joined.length,0)});
test('market snapshot in UTC resolving to same JST date remains eligible',()=>{const x={...m,observedAt:'2026-10-28T00:00:00Z'};assert.equal(joinMarketBreadthResearch([x],[s]).joined.length,1)});
