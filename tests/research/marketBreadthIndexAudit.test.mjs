import test from 'node:test';
import assert from 'node:assert/strict';
import {auditMarketIndexResearchRows} from '../../lib/research/marketBreadthIndexAudit.mjs';
test('unapproved index history cannot become breadth signal',()=>{
 const rows=[{index_key:'nikkei',status:'unavailable',reason:'PROVIDER_APPROVAL_REQUIRED',observed_at:null,value:null},{index_key:'topix',status:'unavailable',reason:'PROVIDER_APPROVAL_REQUIRED',observed_at:null,value:null}];
 const a=auditMarketIndexResearchRows(rows);
 assert.equal(a.counts.total,2);assert.equal(a.counts.usableForBreadth,0);
 assert.equal(a.counts.providerApprovalRequired,2);assert.equal(a.classification,'UNAVAILABLE');
});
test('even observed index levels are insufficient for breadth',()=>{
 assert.equal(auditMarketIndexResearchRows([{index_key:'nikkei',status:'observed',value:40000,observed_at:'2026-10-28T06:00:00Z'}]).counts.usableForBreadth,0);
});
