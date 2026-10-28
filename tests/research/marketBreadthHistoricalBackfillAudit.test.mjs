import test from 'node:test';
import assert from 'node:assert/strict';
import {auditMarketBreadthHistoricalBackfill as audit} from '../../lib/research/marketBreadthHistoricalBackfillAudit.mjs';
test('later insertion is quarantined, not treated as prospective evidence',()=>{const x=audit({records:[{tradeDate:'2026-08-10',createdAt:'2026-08-11T10:50:17Z'}]});assert.equal(x.counts.afterTradeDate,1);assert.equal(x.independentlyVerifiedProspectiveSignals,0);assert.equal(x.aiPromotionAuthorized,false)});
test('same-day insertion still requires attestation',()=>{const x=audit({records:[{tradeDate:'2026-08-10',createdAt:'2026-08-10T09:00:00Z'}]});assert.equal(x.counts.onTradeDate,1);assert.equal(x.quarantined.length,1)});
test('early insertion alone does not prove prediction',()=>{const x=audit({records:[{tradeDate:'2026-08-10',createdAt:'2026-08-09T09:00:00Z'}]});assert.equal(x.counts.beforeTradeDate,1);assert.equal(x.independentlyVerifiedProspectiveSignals,0)});
test('invalid timestamps are rejected',()=>{const x=audit({records:[{tradeDate:'2026-08-10',createdAt:'bad'}]});assert.equal(x.counts.invalid,1)});
test('empty inventory remains unverified',()=>{const x=audit();assert.equal(x.counts.total,0);assert.equal(x.independentImprovementVerified,false)});
