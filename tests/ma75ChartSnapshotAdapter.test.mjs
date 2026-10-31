import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMa75SavedChartSnapshots} from '../app/lib/research/ma75ChartSnapshotAdapter.mjs';
const saved=()=>({
 snapshot_key:'chart:3753:1D',item_count:2,updated_at:'2026-10-30 12:29:55.607503+00',
 payload:{symbol:'3753.T',timeframe:'1D',dataSource:'yahoo_chart',count:2,
  candles:[{time:1793059200,open:320,high:330,low:310,close:325,volume:18000},
           {time:1793145600,open:325,high:340,low:320,close:336,volume:19000}]}
});
const audit=r=>normalizeMa75SavedChartSnapshots(r);
test('normalizes previously saved PG timestamp, code .T and six-bar fields',()=>{
 const r=audit([saved()]);
 assert.equal(r.accepted,1);assert.equal(r.rejectedCount,0);
 assert.equal(r.snapshots[0].code,'3753');
 assert.equal(r.snapshots[0].timeframe,'1D');
 assert.equal(r.snapshots[0].updatedAt,'2026-10-30T12:29:55.607Z');
 assert.equal(r.snapshots[0].candles.length,2);
 assert.equal(r.providerRightsVerified,false);
 assert.equal(r.eligibleForProduction,false);
});
test('bad source, mismatched symbol or timeframe never enter the historical set',()=>{
 for (const alter of [
  x=>{x.payload.symbol='9984.T';},
  x=>{x.payload.timeframe='5m';},
  x=>{x.payload.dataSource='unknown';},
 ]) {
  const x=saved();alter(x);
  const r=audit([x]);
  assert.equal(r.accepted,0);assert.equal(r.rejected[0].reason,'SOURCE_OR_SYMBOL_MISMATCH');
 }
});
test('invalid count, truncated payload, empty or non-object input rejects',()=>{
 for(const alter of [
  x=>{x.item_count=3;},x=>{x.payload.count=3;},
  x=>{x.payload.candles=[];},x=>{x.payload=null;},
 ]){
  const x=saved();alter(x);
  assert.equal(audit([x]).accepted,0);
 }
 assert.throws(()=>audit(null),TypeError);
});
test('rejects bad and duplicate snapshot keys',()=>{
 const x=saved(),bad={...saved(),snapshot_key:'chart:3753:5m'};
 const r=audit([x,{...saved()},bad]);
 assert.equal(r.accepted,1);
 assert.deepEqual(r.rejected.map(x=>x.reason),['DUPLICATE_SAVED_CODE','INVALID_SNAPSHOT_KEY']);
});
test('quarantines millisecond epochs, reversed bar dates and future bars',()=>{
 const ms=saved();ms.payload.candles[0].time*=1000;
 assert.equal(audit([ms]).rejected[0].reason,'INVALID_SAVED_OHLCV');
 const reversed=saved();
 reversed.payload.candles[1].time=reversed.payload.candles[0].time;
 assert.equal(audit([reversed]).rejected[0].reason,'INVALID_SAVED_OHLCV');
 const future=saved();future.payload.candles[1].time=1794000000;
 assert.equal(audit([future]).rejected[0].reason,'BAR_AFTER_SNAPSHOT_SAVE');
});
test('OHLCV geometry/NaN/negative volume are quarantined',()=>{
 for(const key of ['close','volume','high']){
  const x=saved();
  x.payload.candles[0][key]=key==='volume'?-1:key==='high'?1:NaN;
  const r=audit([x]);assert.equal(r.accepted,0);
  assert.equal(r.rejected[0].reason,'INVALID_SAVED_OHLCV');
 }
});
test('invalid saved timestamps and missing payload properties reject',()=>{
 const x=saved();x.updated_at='unknown';
 assert.equal(audit([x]).rejected[0].reason,'INVALID_SAVED_TIMESTAMP');
 const y=saved();delete y.payload.symbol;
 assert.equal(audit([y]).accepted,0);
});
test('multiple distinct valid archived charts preserve original provider and order',()=>{
 const x=saved(),y=saved();y.snapshot_key='chart:9984:1D';
 y.payload.symbol='9984.T';
 const r=audit([x,y]);
 assert.equal(r.accepted,2);
 assert.equal(r.snapshots[1].code,'9984');
 assert.equal(r.snapshots[1].candles[0].volume,18000);
});
