import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateN225Chart, step27Policy } from './step27-n225-offline-evaluator.mjs';
const now = new Date('2026-10-27T01:00:00.000Z'); // 10:00 JST
const payload = (timestamp, close=50000, symbol='^N225') => ({
 chart:{result:[{meta:{symbol},timestamp:[timestamp],indicators:{quote:[{close:[close]}]}}]}
});
const t = s => Math.floor(new Date(s).getTime()/1000);
test('fresh 1m N225 bar passes', () => {
 const result = evaluateN225Chart(payload(t('2026-10-27T00:59:00Z')),now);
 assert.equal(result.status,'observed'); assert.equal(result.ageMinutes,1);
});
test('20 minutes exactly passes',()=>assert.equal(evaluateN225Chart(payload(t('2026-10-27T00:40:00Z')),now).status,'observed'));
test('over 20 minutes is stale',()=>assert.equal(evaluateN225Chart(payload(t('2026-10-27T00:39:00Z')),now).status,'stale'));
test('prior JST date is stale',()=>assert.equal(evaluateN225Chart(payload(t('2026-10-26T14:59:00Z')),now).status,'stale'));
test('future timestamp invalid',()=>assert.equal(evaluateN225Chart(payload(t('2026-10-27T01:01:00Z')),now).status,'invalid'));
test('wrong symbol invalid',()=>assert.equal(evaluateN225Chart(payload(t('2026-10-27T00:59:00Z'),50000,'^TOPX'),now).status,'invalid'));
test('null latest close invalid',()=>assert.equal(evaluateN225Chart(payload(t('2026-10-27T00:59:00Z'),null),now).status,'invalid'));
test('non-numeric latest close invalid',()=>assert.equal(evaluateN225Chart(payload(t('2026-10-27T00:59:00Z'),'50000'),now).status,'invalid'));
test('missing result invalid',()=>assert.equal(evaluateN225Chart({chart:{result:null}},now).status,'invalid'));
test('missing timestamp invalid',()=>assert.equal(evaluateN225Chart(payload(undefined),now).status,'invalid'));
test('latest missing bar cannot be skipped',()=>{
 const p=payload(t('2026-10-27T00:59:00Z'));const q=p.chart.result[0];
 q.timestamp.push(t('2026-10-27T01:00:00Z'));q.indicators.quote[0].close.push(null);
 assert.equal(evaluateN225Chart(p,now).status,'invalid');
});
test('no network or writes enabled',()=>{
 assert.equal(step27Policy.liveFetchEnabled,false);
 assert.equal(step27Policy.databaseWriteEnabled,false);
 assert.equal(step27Policy.cronEnabled,false);
 assert.equal(step27Policy.productionIntegrationEnabled,false);
});
