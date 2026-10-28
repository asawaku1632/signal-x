import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyMarketBreadth} from '../../lib/research/marketBreadthShadow.mjs';
const sample = {tradeDate:'2026-10-28',observedAt:'2026-10-28T11:30:00+09:00',source:'licensed-provider',licenseVerified:true,nikkeiChangePct:1.5,topixChangePct:-0.02,advancers:491,decliners:1028,unchanged:34};
test('flags index/breadth divergence in verified snapshot',()=>{const r=classifyMarketBreadth(sample);assert.equal(r.status,'INDEX_BREADTH_DIVERGENCE');assert.equal(r.total,1553);assert.equal(r.researchOnly,true)});
test('fails closed without verified license',()=>assert.equal(classifyMarketBreadth({...sample,licenseVerified:false}).status,'UNAVAILABLE'));
test('fails closed on missing counts',()=>assert.equal(classifyMarketBreadth({...sample,decliners:undefined}).status,'UNAVAILABLE'));
test('does not flag a broad advance',()=>assert.equal(classifyMarketBreadth({...sample,advancers:1100,decliners:400,topixChangePct:1}).status,'OBSERVED'));
test('rejects inconsistent trade date',()=>assert.equal(classifyMarketBreadth({...sample,tradeDate:'2026-10-27'}).status,'UNAVAILABLE'));
